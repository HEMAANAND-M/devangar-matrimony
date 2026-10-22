"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { maskPhone, normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { requireAdmin } from "@/lib/session";
import { phoneHash } from "@/lib/field-crypto";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

export async function addModerator(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };
  const user = await db.user.findUnique({ where: { phoneHash: phoneHash(phone) } });
  if (!user || !user.phoneVerified) return { error: "No verified account with that number. Ask them to register first." };
  if (user.role !== "USER") return { error: `That account is already ${user.role === "ADMIN" ? "an admin" : "a moderator"}.` };
  if (user.status !== "ACTIVE") return { error: "That account is suspended or banned." };
  await db.user.update({ where: { id: user.id }, data: { role: "MODERATOR" } });
  await log(admin.id, "staff.add_moderator", user.id, maskPhone(phone));
  revalidatePath("/admin/staff");
  return { message: `${maskPhone(phone)} is now a moderator.` };
}

export async function removeModerator(userId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const updated = await db.user.updateMany({ where: { id: userId, role: "MODERATOR" }, data: { role: "USER" } });
  if (!updated.count) return { error: "That account is not a moderator." };
  await log(admin.id, "staff.remove_moderator", userId);
  revalidatePath("/admin/staff");
  return { message: "Moderator access removed." };
}

export async function promoteToAdmin(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (str(fd, "confirm") !== "PROMOTE") return { error: "Type PROMOTE to confirm." };
  const updated = await db.user.updateMany({ where: { id: userId, role: "MODERATOR" }, data: { role: "ADMIN" } });
  if (!updated.count) return { error: "Only moderators can be promoted." };
  await log(admin.id, "staff.promote_admin", userId);
  revalidatePath("/admin/staff");
  return { message: "Promoted to admin." };
}

export async function demoteAdmin(userId: string): Promise<FormState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot demote yourself. Ask another admin." };
  if ((await db.user.count({ where: { role: "ADMIN" } })) <= 1) return { error: "There must always be at least one admin." };
  const updated = await db.user.updateMany({ where: { id: userId, role: "ADMIN" }, data: { role: "MODERATOR" } });
  if (!updated.count) return { error: "That account is not an admin." };
  await log(admin.id, "staff.demote_admin", userId);
  revalidatePath("/admin/staff");
  return { message: "Changed to moderator." };
}
