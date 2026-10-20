"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { link, notifyProfile } from "@/lib/notify";
import { requireAdmin, requireStaff } from "@/lib/session";

/** Every moderation decision is recorded with the staff member who made it. */
function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

export async function approveProfile(profileId: string) {
  const staff = await requireStaff();
  const before = await db.profile.findUnique({ where: { id: profileId }, select: { status: true } });
  const profile = await db.profile.update({ where: { id: profileId }, data: { status: "APPROVED", rejectionReason: null } });
  await log(staff.id, "profile.approve", profileId);
  if (before?.status !== "APPROVED") {
    await notifyProfile(profileId, "profile_approved", { name: profile.name.split(" ")[0], link: link("/dashboard") });
  }
  revalidatePath("/admin");
}

export async function rejectProfile(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const reason = str(fd, "reason").slice(0, 300);
  if (!reason) return { error: "Give a reason so the member can fix their profile." };
  await db.profile.update({ where: { id: profileId }, data: { status: "REJECTED", rejectionReason: reason } });
  await log(staff.id, "profile.reject", profileId, reason);
  revalidatePath("/admin");
  return {};
}

export async function approvePhoto(photoId: string) {
  const staff = await requireStaff();
  await db.photo.update({ where: { id: photoId }, data: { approved: true } });
  await log(staff.id, "photo.approve", photoId);
  revalidatePath("/admin");
}

export async function rejectPhoto(photoId: string) {
  const staff = await requireStaff();
  const photo = await db.photo.delete({ where: { id: photoId } });
  await log(staff.id, "photo.reject", photoId, `profile ${photo.profileId}`);
  revalidatePath("/admin");
}

export async function resolveReport(reportId: string, hideProfile: boolean) {
  const staff = await requireStaff();
  const report = await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  if (hideProfile) {
    // REJECTED rather than HIDDEN: members can un-hide themselves, but not undo moderation.
    await db.profile.update({
      where: { id: report.targetId },
      data: { status: "REJECTED", rejectionReason: "Removed after a member report. Contact support." },
    });
  }
  await log(staff.id, hideProfile ? "report.remove_profile" : "report.dismiss", report.targetId, report.reason.slice(0, 200));
  revalidatePath("/admin");
}

export async function addModerator(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !user.phoneVerified) return { error: "No verified account with that number. Ask them to register first." };
  if (user.role === "ADMIN") return { error: "That account is already an admin." };
  await db.user.update({ where: { id: user.id }, data: { role: "MODERATOR" } });
  await log(admin.id, "staff.add_moderator", user.id, phone);
  revalidatePath("/admin");
  return { message: `${phone} is now a moderator.` };
}

export async function removeModerator(userId: string) {
  const admin = await requireAdmin();
  const updated = await db.user.updateMany({ where: { id: userId, role: "MODERATOR" }, data: { role: "USER" } });
  if (updated.count) await log(admin.id, "staff.remove_moderator", userId);
  revalidatePath("/admin");
}
