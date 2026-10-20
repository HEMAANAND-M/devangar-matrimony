"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { UPLOAD_DIR } from "@/lib/photos";
import { requireAdmin } from "@/lib/session";

export async function approveProfile(profileId: string) {
  await requireAdmin();
  await db.profile.update({ where: { id: profileId }, data: { status: "APPROVED", rejectionReason: null } });
  revalidatePath("/admin");
}

export async function rejectProfile(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const reason = str(fd, "reason");
  if (!reason) return { error: "Give a reason so the member can fix their profile." };
  await db.profile.update({ where: { id: profileId }, data: { status: "REJECTED", rejectionReason: reason } });
  revalidatePath("/admin");
  return {};
}

export async function approvePhoto(photoId: string) {
  await requireAdmin();
  await db.photo.update({ where: { id: photoId }, data: { approved: true } });
  revalidatePath("/admin");
}

export async function rejectPhoto(photoId: string) {
  await requireAdmin();
  const photo = await db.photo.delete({ where: { id: photoId } });
  await unlink(path.join(UPLOAD_DIR, photo.fileName)).catch(() => {});
  revalidatePath("/admin");
}

export async function resolveReport(reportId: string, hideProfile: boolean) {
  await requireAdmin();
  const report = await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  if (hideProfile) {
    // REJECTED rather than HIDDEN: members can un-hide themselves, but not undo moderation.
    await db.profile.update({
      where: { id: report.targetId },
      data: { status: "REJECTED", rejectionReason: "Removed after a member report. Contact support." },
    });
  }
  revalidatePath("/admin");
}
