"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { requireProfile } from "@/lib/session";

const DAILY_INTEREST_LIMIT = 20;

async function approvedTarget(targetId: string, viewerGender: string) {
  return db.profile.findFirst({
    where: { id: targetId, status: "APPROVED", gender: { not: viewerGender as "MALE" | "FEMALE" } },
  });
}

export async function sendInterest(targetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (profile.status !== "APPROVED") {
    return { error: "You can send interests once your profile is approved." };
  }
  const target = await approvedTarget(targetId, profile.gender);
  if (!target) return { error: "This profile is not available." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await db.interest.count({ where: { fromId: profile.id, createdAt: { gte: since } } });
  if (sentToday >= DAILY_INTEREST_LIMIT) return { error: "Daily interest limit reached. Try again tomorrow." };

  const reverse = await db.interest.findUnique({ where: { fromId_toId: { fromId: target.id, toId: profile.id } } });
  if (reverse) return { error: "This member has already sent you an interest. Respond to it from Interests." };

  await db.interest.upsert({
    where: { fromId_toId: { fromId: profile.id, toId: target.id } },
    create: { fromId: profile.id, toId: target.id, message: str(fd, "message").slice(0, 300) || null },
    update: {},
  });
  revalidatePath(`/profiles/${target.code}`);
  return { message: "Interest sent." };
}

export async function respondInterest(interestId: string, accept: boolean) {
  const { profile } = await requireProfile();
  await db.interest.updateMany({
    where: { id: interestId, toId: profile.id, status: "PENDING" },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });
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
  } else if (await approvedTarget(targetId, profile.gender)) {
    await db.shortlist.create({ data: { ownerId: profile.id, targetId } });
  }
  revalidatePath("/shortlist");
  revalidatePath("/profiles/[code]", "page");
}

export async function reportProfile(targetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  const reason = str(fd, "reason");
  if (reason.length < 10) return { error: "Please describe the problem (at least 10 characters)." };
  if (targetId === profile.id) return { error: "You cannot report your own profile." };
  await db.report.create({ data: { reporterId: profile.id, targetId, reason: reason.slice(0, 1000) } });
  return { message: "Thank you. Our team will review this profile." };
}
