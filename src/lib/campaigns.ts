import "server-only";
import type { NotificationChannel, Prisma, ProfileStatus } from "@prisma/client";
import { db } from "./db";
import { TEMPLATES, type Template, deliver } from "./notify";

/**
 * Admin campaigns: bulk WhatsApp or email to a filtered group of opted-in members. Rows are queued
 * as Notifications with a campaignId and delivered in batches by /api/cron/campaigns.
 */
export type Audience = {
  segment?: "all" | "premium" | "free";
  gender?: "MALE" | "FEMALE";
  city?: string;
  /** Members not seen for at least this many days. */
  inactiveDays?: number;
  /** Profile status; "ANY" = any status, "NONE" = also accounts without a profile. */
  status?: ProfileStatus | "ANY" | "NONE";
  joinedAfter?: string;
  joinedBefore?: string;
};

const STATUSES = ["APPROVED", "PENDING", "REJECTED", "HIDDEN", "MARRIED", "ANY", "NONE"] as const;
export const CAMPAIGN_STATUS_OPTIONS = STATUSES;

const day = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Normalises filters from a form or stored JSON; unknown values are dropped. */
export function parseAudience(raw: Record<string, unknown>): Audience {
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const segment = str("segment");
  const gender = str("gender");
  const status = str("status") || "APPROVED";
  const inactive = Math.floor(Number(str("inactiveDays")));
  return {
    ...(segment === "premium" || segment === "free" ? { segment } : { segment: "all" }),
    ...(gender === "MALE" || gender === "FEMALE" ? { gender } : {}),
    ...(str("city") ? { city: str("city").slice(0, 60) } : {}),
    ...(inactive > 0 && inactive <= 3650 ? { inactiveDays: inactive } : {}),
    status: (STATUSES as readonly string[]).includes(status) ? (status as Audience["status"]) : "APPROVED",
    ...(day(str("joinedAfter")) ? { joinedAfter: day(str("joinedAfter")) } : {}),
    ...(day(str("joinedBefore")) ? { joinedBefore: day(str("joinedBefore")) } : {}),
  };
}

/** Members who match the filters, have opted into the channel and are not suspended or banned. */
export function audienceWhere(a: Audience, channel: NotificationChannel): Prisma.UserWhereInput {
  const now = new Date();
  const profile: Prisma.ProfileWhereInput = {
    ...(a.status && a.status !== "ANY" && a.status !== "NONE" ? { status: a.status } : {}),
    ...(a.gender ? { gender: a.gender } : {}),
    ...(a.city ? { city: { equals: a.city, mode: "insensitive" } } : {}),
    ...(a.segment === "premium" ? { premiumUntil: { gt: now } } : {}),
    ...(a.segment === "free" ? { OR: [{ premiumUntil: null }, { premiumUntil: { lte: now } }] } : {}),
  };
  const needsProfile = a.status !== "NONE" || Object.keys(profile).length > 0;
  const and: Prisma.UserWhereInput[] = [
    { role: "USER", status: "ACTIVE", phoneVerified: true },
    channel === "EMAIL" ? { emailOptIn: true, email: { not: null } } : { whatsappOptIn: true },
  ];
  if (needsProfile) and.push({ profile: { is: profile } });
  if (a.inactiveDays) {
    const cutoff = new Date(now.getTime() - a.inactiveDays * 24 * 60 * 60 * 1000);
    and.push({ OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] });
  }
  if (a.joinedAfter) and.push({ createdAt: { gte: new Date(`${a.joinedAfter}T00:00:00+05:30`) } });
  if (a.joinedBefore) and.push({ createdAt: { lt: new Date(new Date(`${a.joinedBefore}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000) } });
  return { AND: and };
}

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/** Start of the India calendar day `offset` days from today, as a UTC instant. */
export function istDayStart(offset = 0, now = Date.now()): Date {
  const ist = new Date(now + IST_OFFSET);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + offset) - IST_OFFSET);
}

export const firstName = (name: string | null | undefined) => (name?.trim().split(/\s+/)[0] || "Member");

/** Template parameters in TEMPLATES order, with "{name}" replaced and WhatsApp-safe text. */
export function fillParams(template: Template, params: Record<string, string>, name: string, channel: NotificationChannel): string[] {
  return TEMPLATES[template].map((key) => {
    const raw = key === "name" ? name : (params[key] ?? "").replaceAll("{name}", name);
    // WhatsApp rejects template parameters with new lines, tabs or 4+ consecutive spaces.
    return channel === "WHATSAPP" ? raw.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").slice(0, 1024) : raw.slice(0, 2000);
  });
}

/** Templates that make sense for bulk sending (the rest are one-to-one events). */
export const BULK_TEMPLATES = ["announcement", "weekly_matches", "premium_expiring", "premium_expired"] as const satisfies readonly Template[];

export const isTemplate = (t: string): t is Template => Object.hasOwn(TEMPLATES, t);
export const isBulkTemplate = (t: string): t is (typeof BULK_TEMPLATES)[number] => (BULK_TEMPLATES as readonly string[]).includes(t);

/** Delivers up to `limit` pending campaign messages, then closes campaigns with nothing left. */
export async function runCampaignBatch(limit = 200) {
  const pending = await db.notification.findMany({
    where: { status: "PENDING", campaign: { status: "SENDING" } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (let i = 0; i < pending.length; i += 10) {
    await Promise.all(pending.slice(i, i + 10).map((n) => deliver(n.id)));
  }
  const sending = await db.campaign.findMany({ where: { status: "SENDING" }, select: { id: true } });
  let finished = 0;
  for (const c of sending) {
    const left = await db.notification.count({ where: { campaignId: c.id, status: "PENDING" } });
    if (!left) {
      await db.campaign.update({ where: { id: c.id }, data: { status: "SENT", finishedAt: new Date() } });
      finished++;
    }
  }
  return { delivered: pending.length, finished };
}
