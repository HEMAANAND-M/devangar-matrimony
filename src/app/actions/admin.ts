"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { refreshFlags } from "@/lib/flags";
import type { FormState } from "@/lib/form";
import { link, notifyProfile } from "@/lib/notify";
import { requireStaff } from "@/lib/session";
import { deletePhoto } from "@/lib/storage";

/** Every moderation decision is recorded with the staff member who made it. */
function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const firstName = (name: string) => name.split(" ")[0];

/** Refreshes every admin page so sidebar counts stay in step. */
function revalidateModeration() {
  revalidatePath("/admin", "layout");
}

export async function approveProfile(profileId: string): Promise<FormState> {
  const staff = await requireStaff();
  const before = await db.profile.findUnique({ where: { id: profileId }, select: { status: true } });
  if (!before) return { error: "Profile no longer exists." };
  const profile = await db.profile.update({ where: { id: profileId }, data: { status: "APPROVED", rejectionReason: null } });
  await log(staff.id, "profile.approve", profileId);
  if (before.status !== "APPROVED") {
    await notifyProfile(profileId, "profile_approved", { name: firstName(profile.name), link: link("/dashboard") });
  }
  revalidateModeration();
  return { message: "Approved" };
}

export async function approveProfiles(profileIds: string[]): Promise<FormState> {
  await requireStaff();
  const ids = profileIds.slice(0, 100);
  let approved = 0;
  for (const id of ids) if (!(await approveProfile(id)).error) approved++;
  return { message: `${approved} profile${approved === 1 ? "" : "s"} approved` };
}

export async function rejectProfile(profileId: string, rawReason: string): Promise<FormState> {
  const staff = await requireStaff();
  const reason = rawReason.trim().slice(0, 300);
  if (!reason) return { error: "Give a reason so the member can fix their profile." };
  const exists = await db.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!exists) return { error: "Profile no longer exists." };
  const profile = await db.profile.update({ where: { id: profileId }, data: { status: "REJECTED", rejectionReason: reason } });
  await log(staff.id, "profile.reject", profileId, reason);
  await notifyProfile(profileId, "profile_rejected", { name: firstName(profile.name), reason, link: link("/profile/edit") });
  revalidateModeration();
  return { message: "Rejected" };
}

export async function approvePhoto(photoId: string): Promise<FormState> {
  const staff = await requireStaff();
  const updated = await db.photo.updateMany({ where: { id: photoId }, data: { approved: true } });
  if (!updated.count) return { error: "Photo no longer exists." };
  await log(staff.id, "photo.approve", photoId);
  revalidateModeration();
  return { message: "Approved" };
}

export async function approvePhotos(photoIds: string[]): Promise<FormState> {
  const staff = await requireStaff();
  const ids = photoIds.slice(0, 200);
  const updated = await db.photo.updateMany({ where: { id: { in: ids } }, data: { approved: true } });
  await db.adminLog.createMany({ data: ids.map((id) => ({ adminId: staff.id, action: "photo.approve", targetId: id })) });
  revalidateModeration();
  return { message: `${updated.count} photo${updated.count === 1 ? "" : "s"} approved` };
}

/** Rejected photos are deleted outright; the member is told why. */
export async function rejectPhoto(photoId: string, rawReason: string): Promise<FormState> {
  const staff = await requireStaff();
  const reason = rawReason.trim().slice(0, 300);
  if (!reason) return { error: "Choose or type a reason." };
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { profileId: true, isPrimary: true, profile: { select: { name: true } } } });
  if (!photo) return { error: "Photo no longer exists." };
  await deletePhoto(photoId);
  await db.photo.delete({ where: { id: photoId } });
  if (photo.isPrimary) {
    const next = await db.photo.findFirst({ where: { profileId: photo.profileId }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (next) await db.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  await log(staff.id, "photo.reject", photoId, `profile ${photo.profileId} — ${reason}`);
  await notifyProfile(photo.profileId, "photo_rejected", { name: firstName(photo.profile.name), reason, link: link("/photos") });
  revalidateModeration();
  return { message: "Rejected" };
}

export async function updateReport(reportId: string, priority: number, notes: string): Promise<FormState> {
  const staff = await requireStaff();
  if (![1, 2, 3].includes(priority)) return { error: "Invalid priority." };
  const updated = await db.report.updateMany({ where: { id: reportId }, data: { priority, notes: notes.trim().slice(0, 2000) || null } });
  if (!updated.count) return { error: "Report no longer exists." };
  await log(staff.id, "report.update", reportId, `priority ${priority}`);
  revalidateModeration();
  return { message: "Saved" };
}

export type ReportResolution = "dismiss" | "warn" | "remove";

export async function resolveReport(reportId: string, resolution: ReportResolution, rawNote = ""): Promise<FormState> {
  const staff = await requireStaff();
  const note = rawNote.trim().slice(0, 500);
  if (resolution === "warn" && !note) return { error: "Add a note describing the warning." };
  const existing = await db.report.findUnique({ where: { id: reportId } });
  if (!existing) return { error: "Report no longer exists." };
  if (existing.resolved) return { error: "Already resolved." };
  const summary = { dismiss: "Dismissed", warn: "Warned", remove: "Profile removed" }[resolution];
  const report = await db.report.update({
    where: { id: reportId },
    data: { resolved: true, resolution: note ? `${summary}: ${note}` : summary, resolvedAt: new Date(), resolvedById: staff.id },
  });
  if (resolution === "remove") {
    // REJECTED rather than HIDDEN: members can un-hide themselves, but not undo moderation.
    await db.profile.update({
      where: { id: report.targetId },
      data: { status: "REJECTED", rejectionReason: "Removed after a member report. Contact support." },
    });
  }
  const action = { dismiss: "report.dismiss", warn: "report.warn", remove: "report.remove_profile" }[resolution];
  await log(staff.id, action, report.targetId, (note || report.reason).slice(0, 200));
  await refreshFlags(report.targetId);
  revalidateModeration();
  return { message: summary };
}
