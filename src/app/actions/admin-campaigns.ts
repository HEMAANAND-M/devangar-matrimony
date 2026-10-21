"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { NotificationChannel } from "@prisma/client";
import { audienceWhere, fillParams, firstName, isBulkTemplate, isTemplate, istDayStart, parseAudience, runCampaignBatch, type Audience } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { TEMPLATES, deliver, link } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

/** A safety rail against accidental floods: at most this many campaigns started per India day. */
const MAX_CAMPAIGNS_PER_DAY = 3;
const CHUNK = 500;

const channelOf = (v: string): NotificationChannel => (v === "EMAIL" ? "EMAIL" : "WHATSAPP");

/** Relative links become absolute; anything else must be https. */
function normalizeLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (/^\/[^/]/.test(v) || v === "/") return link(v);
  return /^https:\/\/[^\s]+$/.test(v) ? v : null;
}

type CampaignInput = { name: string; template: string; channel: NotificationChannel; params: Record<string, string>; audience: Audience };

function parseCampaignForm(fd: FormData): CampaignInput | { error: string } {
  const name = str(fd, "name").slice(0, 120);
  if (!name) return { error: "Give the campaign a name." };
  const template = str(fd, "template");
  if (!isBulkTemplate(template)) return { error: "Choose a message template." };
  const params: Record<string, string> = {};
  for (const key of TEMPLATES[template]) {
    if (key === "name") continue;
    const value = str(fd, `p_${key}`);
    if (key === "link") {
      const normalized = normalizeLink(value);
      if (normalized === null) return { error: "Links must start with / or https://" };
      params.link = normalized;
    } else {
      if (!value) return { error: `Fill in “${key}”.` };
      params[key] = value.slice(0, key === "message" ? 1000 : 200);
    }
  }
  const audience = parseAudience(Object.fromEntries(AUDIENCE_FIELDS.map((k) => [k, str(fd, k)])));
  return { name, template, channel: channelOf(str(fd, "channel")), params, audience };
}

const AUDIENCE_FIELDS = ["segment", "gender", "city", "inactiveDays", "status", "joinedAfter", "joinedBefore"];

export async function createCampaign(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const input = parseCampaignForm(fd);
  if ("error" in input) return input;
  const campaign = await db.campaign.create({ data: { ...input, createdById: admin.id } });
  await log(admin.id, "campaign.create", campaign.id, input.name);
  revalidatePath("/admin/campaigns");
  return { redirect: `/admin/campaigns/${campaign.id}` };
}

export async function updateCampaign(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const input = parseCampaignForm(fd);
  if ("error" in input) return input;
  const { count } = await db.campaign.updateMany({ where: { id, status: "DRAFT" }, data: input });
  if (!count) return { error: "Only drafts can be edited." };
  revalidatePath(`/admin/campaigns/${id}`);
  return { message: "Draft saved. The recipient count and preview below are up to date." };
}

export async function deleteCampaign(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const { count } = await db.campaign.deleteMany({ where: { id, status: "DRAFT" } });
  if (!count) return { error: "Only drafts can be deleted." };
  await log(admin.id, "campaign.delete", id);
  return { redirect: "/admin/campaigns" };
}

/** Sends the campaign's message to the signed-in admin only, regardless of opt-in. */
export async function sendTestCampaign(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || !isTemplate(campaign.template)) return { error: "Campaign not found." };
  if (campaign.channel === "EMAIL" && !admin.email) return { error: "Add an email address to your account (Settings) to receive a test email." };
  const name = firstName(admin.profile?.name) === "Member" ? "Admin" : firstName(admin.profile?.name);
  const n = await db.notification.create({
    data: {
      userId: admin.id,
      template: campaign.template,
      channel: campaign.channel,
      params: fillParams(campaign.template, campaign.params as Record<string, string>, name, campaign.channel),
    },
  });
  await deliver(n.id);
  const result = await db.notification.findUnique({ where: { id: n.id }, select: { status: true, error: true } });
  if (result?.status === "SENT") return { message: `Test sent to you by ${campaign.channel === "EMAIL" ? "email" : "WhatsApp"}.` };
  if (result?.status === "NOT_CONFIGURED") return { error: `${campaign.channel === "EMAIL" ? "Email" : "WhatsApp"} is not configured on this server, so nothing was sent.` };
  return { error: `Sending failed: ${result?.error ?? "unknown error"}` };
}

export async function startCampaign(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || !isTemplate(campaign.template)) return { error: "Campaign not found." };
  if (campaign.status !== "DRAFT") return { error: "This campaign has already been started." };
  if (!(await featureEnabled(campaign.channel === "EMAIL" ? "email" : "whatsapp"))) {
    return { error: `${campaign.channel === "EMAIL" ? "Email" : "WhatsApp"} is switched off in Settings → Feature switches.` };
  }
  const startedToday = await db.campaign.count({ where: { startedAt: { gte: istDayStart(0) } } });
  if (startedToday >= MAX_CAMPAIGNS_PER_DAY) return { error: `At most ${MAX_CAMPAIGNS_PER_DAY} campaigns can be started per day.` };

  // Claim the draft first, so a double click cannot queue the campaign twice.
  const claimed = await db.campaign.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENDING", startedAt: new Date() } });
  if (!claimed.count) return { error: "This campaign has already been started." };

  const template = campaign.template;
  const params = campaign.params as Record<string, string>;
  const recipients = await db.user.findMany({
    where: audienceWhere(campaign.audience as Audience, campaign.channel),
    select: { id: true, profile: { select: { name: true } } },
  });
  for (let i = 0; i < recipients.length; i += CHUNK) {
    await db.notification.createMany({
      data: recipients.slice(i, i + CHUNK).map((u) => ({
        userId: u.id,
        template,
        channel: campaign.channel,
        campaignId: id,
        params: fillParams(template, params, firstName(u.profile?.name), campaign.channel),
      })),
    });
  }
  await db.campaign.update({
    where: { id },
    data: { totalRecipients: recipients.length, ...(recipients.length ? {} : { status: "SENT", finishedAt: new Date() }) },
  });
  await log(admin.id, "campaign.start", id, `${campaign.name} · ${recipients.length} recipients · ${campaign.channel.toLowerCase()}`);
  // The first batch goes out straight away; the cron job sends the rest every 10 minutes.
  if (recipients.length) after(() => runCampaignBatch(200).then(() => {}, () => {}));
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { message: recipients.length ? `Sending to ${recipients.length.toLocaleString("en-IN")} members.` : "No members match this audience, so nothing was sent." };
}

export async function cancelCampaign(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const { count } = await db.campaign.updateMany({ where: { id, status: { in: ["DRAFT", "SENDING"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  if (!count) return { error: "This campaign has already finished." };
  const stopped = await db.notification.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "FAILED", error: "cancelled" } });
  await log(admin.id, "campaign.cancel", id, `${stopped.count} unsent`);
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { message: `Cancelled. ${stopped.count.toLocaleString("en-IN")} messages were not sent.` };
}
