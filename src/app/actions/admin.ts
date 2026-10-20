"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { requireAdmin } from "@/lib/session";

/** Every moderation decision is recorded with the admin who made it. */
function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

export async function approveProfile(profileId: string) {
  const admin = await requireAdmin();
  await db.profile.update({ where: { id: profileId }, data: { status: "APPROVED", rejectionReason: null } });
  await log(admin.id, "profile.approve", profileId);
  revalidatePath("/admin");
}

export async function rejectProfile(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const reason = str(fd, "reason").slice(0, 300);
  if (!reason) return { error: "Give a reason so the member can fix their profile." };
  await db.profile.update({ where: { id: profileId }, data: { status: "REJECTED", rejectionReason: reason } });
  await log(admin.id, "profile.reject", profileId, reason);
  revalidatePath("/admin");
  return {};
}

export async function approvePhoto(photoId: string) {
  const admin = await requireAdmin();
  await db.photo.update({ where: { id: photoId }, data: { approved: true } });
  await log(admin.id, "photo.approve", photoId);
  revalidatePath("/admin");
}

export async function rejectPhoto(photoId: string) {
  const admin = await requireAdmin();
  const photo = await db.photo.delete({ where: { id: photoId } });
  await log(admin.id, "photo.reject", photoId, `profile ${photo.profileId}`);
  revalidatePath("/admin");
}

export async function resolveReport(reportId: string, hideProfile: boolean) {
  const admin = await requireAdmin();
  const report = await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  if (hideProfile) {
    // REJECTED rather than HIDDEN: members can un-hide themselves, but not undo moderation.
    await db.profile.update({
      where: { id: report.targetId },
      data: { status: "REJECTED", rejectionReason: "Removed after a member report. Contact support." },
    });
  }
  await log(admin.id, hideProfile ? "report.remove_profile" : "report.dismiss", report.targetId, report.reason.slice(0, 200));
  revalidatePath("/admin");
}
