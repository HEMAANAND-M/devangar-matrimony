"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { findContactInfo } from "@/lib/moderation";
import { link, notifyProfile } from "@/lib/notify";
import { FREE_DAILY_INTERESTS, dailyInterestLimit, isPremium } from "@/lib/premium";
import { browsableWhere } from "@/lib/queries";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireProfile } from "@/lib/session";

type Viewer = Awaited<ReturnType<typeof requireProfile>>["profile"];

/** Target the viewer may interact with: approved, opposite gender, and no block either way. */
function browsableTarget(targetId: string, viewer: Viewer) {
  return db.profile.findFirst({ where: { ...browsableWhere(viewer), id: targetId } });
}

export async function sendInterest(targetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (profile.status !== "APPROVED") {
    return { error: "You can send interests once your profile is approved." };
  }
  const target = await browsableTarget(targetId, profile);
  if (!target) return { error: "This profile is not available." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await db.interest.count({ where: { fromId: profile.id, createdAt: { gte: since } } });
  if (sentToday >= dailyInterestLimit(profile)) {
    return {
      error: isPremium(profile)
        ? "Daily interest limit reached. Try again tomorrow."
        : `Free members can send ${FREE_DAILY_INTERESTS} interests a day. Upgrade to Premium to send more.`,
    };
  }

  const message = str(fd, "message").slice(0, 300) || null;
  const found = findContactInfo(message);
  if (found) return { error: `Please remove ${found} from your message. Contact details are shared once the interest is accepted.` };

  const reverse = await db.interest.findUnique({ where: { fromId_toId: { fromId: target.id, toId: profile.id } } });
  if (reverse) return { error: "This member has already sent you an interest. Respond to it from Interests." };

  const existing = await db.interest.findUnique({ where: { fromId_toId: { fromId: profile.id, toId: target.id } } });
  if (!existing) {
    await db.interest.create({ data: { fromId: profile.id, toId: target.id, message } });
    await notifyProfile(target.id, "interest_received", { name: target.name.split(" ")[0], fromCode: profile.code, link: link("/interests") });
  }
  revalidatePath(`/profiles/${target.code}`);
  return { message: "Interest sent." };
}

export async function respondInterest(interestId: string, accept: boolean) {
  const { profile } = await requireProfile();
  const updated = await db.interest.updateMany({
    where: { id: interestId, toId: profile.id, status: "PENDING" },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });
  if (updated.count && accept) {
    const interest = await db.interest.findUnique({ where: { id: interestId }, include: { from: { select: { id: true, name: true } } } });
    if (interest) {
      await notifyProfile(interest.from.id, "interest_accepted", { name: interest.from.name.split(" ")[0], byCode: profile.code, link: link(`/profiles/${profile.code}`) });
    }
  }
  revalidatePath("/interests");
}

export async function withdrawInterest(interestId: string) {
  const { profile } = await requireProfile();
  await db.interest.deleteMany({ where: { id: interestId, fromId: profile.id, status: "PENDING" } });
  revalidatePath("/interests");
}

export async function toggleShortlist(targetId: string) {
  const { profile } = await requireProfile();
  const key = { ownerId_targetId: { ownerId: profile.id, targetId } };
  const existing = await db.shortlist.findUnique({ where: key });
  if (existing) {
    await db.shortlist.delete({ where: key });
  } else if (await browsableTarget(targetId, profile)) {
    await db.shortlist.create({ data: { ownerId: profile.id, targetId } });
  }
  revalidatePath("/shortlist");
  revalidatePath("/profiles/[code]", "page");
}

export async function reportProfile(targetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (!(await rateLimitAll([[`report:${profile.id}`, 10, 24 * HOUR]]))) return { error: RATE_LIMITED };
  const reason = str(fd, "reason");
  if (reason.length < 10) return { error: "Please describe the problem (at least 10 characters)." };
  if (targetId === profile.id) return { error: "You cannot report your own profile." };
  if (!(await db.profile.findUnique({ where: { id: targetId }, select: { id: true } }))) {
    return { error: "This profile is not available." };
  }
  await db.report.create({ data: { reporterId: profile.id, targetId, reason: reason.slice(0, 1000) } });
  return { message: "Thank you. Our team will review this profile." };
}

/**
 * Blocking hides both members from each other everywhere and withdraws any pending interest
 * between them. Accepted connections are removed too, so contact details stop being shown.
 */
export async function blockProfile(targetId: string) {
  const { profile } = await requireProfile();
  if (targetId === profile.id) return;
  if (!(await db.profile.findUnique({ where: { id: targetId }, select: { id: true } }))) return;
  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId: profile.id, blockedId: targetId } },
      create: { blockerId: profile.id, blockedId: targetId },
      update: {},
    }),
    db.interest.deleteMany({
      where: { OR: [{ fromId: profile.id, toId: targetId }, { fromId: targetId, toId: profile.id }] },
    }),
    db.shortlist.deleteMany({ where: { ownerId: profile.id, targetId } }),
  ]);
  revalidatePath("/", "layout");
  redirect("/settings?blocked=1");
}

/** Form-friendly wrapper so the block button can show a confirm dialog via ActionForm. */
export async function blockFromForm(targetId: string): Promise<FormState> {
  await blockProfile(targetId);
  return {};
}

export async function unblockProfile(targetId: string) {
  const { profile } = await requireProfile();
  await db.block.deleteMany({ where: { blockerId: profile.id, blockedId: targetId } });
  revalidatePath("/settings");
}
