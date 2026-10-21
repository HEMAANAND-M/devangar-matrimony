"use server";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MOTHER_TONGUES, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/format";
import { type FormState, opt, str } from "@/lib/form";
import { findContactInfo } from "@/lib/moderation";
import { link, notifyProfile } from "@/lib/notify";
import { getPlan } from "@/lib/plans";
import { extendPremium, rupees } from "@/lib/premium";
import { requireAdmin, requireStaff } from "@/lib/session";
import { deletePhotos } from "@/lib/storage";
import { logSecurity } from "@/lib/security-log";

/** Every staff decision is recorded with the staff member who made it. */
function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const memberPath = (userId: string) => `/admin/members/${userId}`;
const firstName = (name: string) => name.split(" ")[0];

/** Loads a member account an admin may act on: never staff, never the acting admin. */
async function targetMember(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { profile: { select: { id: true, name: true, code: true } } } });
  if (!user) return { error: "Account not found." } as const;
  if (user.role !== "USER") return { error: "Staff accounts are managed on the Staff page." } as const;
  return { user } as const;
}

export async function bulkApprove(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const userIds = fd.getAll("ids").filter((v): v is string => typeof v === "string").slice(0, 200);
  if (!userIds.length) return { error: "Select at least one member." };
  const pending = await db.profile.findMany({ where: { userId: { in: userIds }, status: "PENDING" }, select: { id: true, name: true } });
  if (!pending.length) return { error: "None of the selected members have a profile waiting for review." };
  await db.profile.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "APPROVED", rejectionReason: null } });
  await db.adminLog.createMany({ data: pending.map((p) => ({ adminId: staff.id, action: "profile.approve", targetId: p.id, detail: "bulk" })) });
  await Promise.all(pending.map((p) => notifyProfile(p.id, "profile_approved", { name: firstName(p.name), link: link("/dashboard") })));
  revalidatePath("/admin", "layout");
  const skipped = userIds.length - pending.length;
  return { message: `Approved ${pending.length} profile${pending.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped (not pending)` : ""}.` };
}

export async function setAccountStatus(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const t = await targetMember(userId);
  if ("error" in t) return { error: t.error };
  const status = str(fd, "status");
  if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "BANNED") return { error: "Choose a status." };
  const reason = str(fd, "reason").slice(0, 300);
  if (status !== "ACTIVE" && !reason) return { error: "Give a reason. The member will see it when they try to sign in." };
  const untilRaw = str(fd, "until");
  const until = status === "SUSPENDED" && untilRaw ? new Date(`${untilRaw}T23:59:59+05:30`) : null;
  if (until && (Number.isNaN(until.getTime()) || until <= new Date())) return { error: "The end date must be in the future." };

  await db.user.update({
    where: { id: userId },
    data: {
      status,
      statusReason: status === "ACTIVE" ? null : reason,
      suspendedUntil: until,
      // Suspension takes effect immediately on every device.
      ...(status !== "ACTIVE" ? { sessionVersion: { increment: 1 } } : {}),
    },
  });
  const action = status === "ACTIVE" ? "member.reactivate" : status === "BANNED" ? "member.ban" : "member.suspend";
  await log(admin.id, action, userId, [reason, until && `until ${untilRaw}`].filter(Boolean).join(" · ") || undefined);
  if (status !== "ACTIVE" && t.user.profile) {
    await notifyProfile(t.user.profile.id, "account_suspended", { name: firstName(t.user.profile.name), reason });
  }
  revalidatePath(memberPath(userId));
  return { message: status === "ACTIVE" ? "Account reactivated." : status === "BANNED" ? "Account banned and signed out." : "Account suspended and signed out." };
}

export async function forceLogout(userId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const t = await targetMember(userId);
  if ("error" in t) return { error: t.error };
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  await log(admin.id, "member.force_logout", userId);
  await logSecurity(userId, "staff_signed_out");
  revalidatePath(memberPath(userId));
  return { message: "Signed out on all devices." };
}

// No look-alike characters (0/O, 1/l/I), so it can be read out over the phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function resetMemberPassword(userId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const t = await targetMember(userId);
  if ("error" in t) return { error: t.error };
  let password = "";
  while (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    password = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } } });
  await log(admin.id, "member.reset_password", userId);
  await logSecurity(userId, "staff_password_reset");
  revalidatePath(memberPath(userId));
  return { message: `Temporary password: ${password} — share it with the member directly; it is not shown again. Ask them to change it in Settings.` };
}

export async function revealPhone(userId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user) return { error: "Account not found." };
  await log(admin.id, "member.reveal_phone", userId);
  return { message: user.phone };
}

export async function saveStaffNotes(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const notes = str(fd, "notes").slice(0, 4000);
  const profile = await db.profile.update({ where: { id: profileId }, data: { staffNotes: notes || null }, select: { userId: true } });
  await log(staff.id, "member.notes", profileId);
  revalidatePath(memberPath(profile.userId));
  return { message: "Notes saved." };
}

const o = <T extends z.ZodTypeAny>(s: T) => s.optional().transform((v) => v ?? null);
const editSchema = z.object({
  name: z.string().min(2, "Enter the full name").max(80),
  maritalStatus: z.enum(["NEVER_MARRIED", "DIVORCED", "WIDOWED", "AWAITING_DIVORCE"]),
  heightCm: o(z.coerce.number().int().min(120).max(230)),
  motherTongue: z.enum(MOTHER_TONGUES as [string, ...string[]]),
  gothram: o(z.string().max(60)),
  star: o(z.enum(STARS as [string, ...string[]])),
  rasi: o(z.enum(RASIS as [string, ...string[]])),
  education: z.string().min(2, "Enter education").max(120),
  occupation: z.string().min(2, "Enter occupation").max(120),
  annualIncome: o(z.string().max(40)),
  city: z.string().min(2, "Enter city").max(60),
  state: z.string().min(2).max(60),
  about: o(z.string().max(1500)),
});
const EDITABLE_FIELDS = Object.keys(editSchema.shape) as (keyof z.infer<typeof editSchema>)[];

export async function editMemberProfile(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = editSchema.safeParse(Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, opt(fd, k)])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const contact = findContactInfo(parsed.data.about);
  if (contact) return { error: `About text contains ${contact}; members may not share contact details there.` };
  const before = await db.profile.findUnique({ where: { id: profileId } });
  if (!before) return { error: "Profile not found." };
  const changed = EDITABLE_FIELDS.filter((k) => String(before[k] ?? "") !== String(parsed.data[k] ?? ""));
  if (!changed.length) return { message: "No changes." };
  await db.profile.update({ where: { id: profileId }, data: parsed.data });
  await log(admin.id, "profile.edit", profileId, `Changed: ${changed.join(", ")}`);
  revalidatePath(memberPath(before.userId));
  return { message: `Saved ${changed.length} change${changed.length === 1 ? "" : "s"}.` };
}

export async function grantPremium(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const planId = str(fd, "plan");
  const plan = planId ? await getPlan(planId, { includeInactive: true }) : undefined;
  const months = plan ? plan.months : Number(str(fd, "months"));
  if (!Number.isInteger(months) || months < 1 || months > 24) return { error: "Choose a plan or enter 1–24 months." };
  const amountRupees = Number(str(fd, "amount") || "0");
  if (!Number.isFinite(amountRupees) || amountRupees < 0 || amountRupees > 100000) return { error: "Enter the amount received in rupees (0 for complimentary)." };
  const note = str(fd, "note").slice(0, 200);
  if (!note) return { error: "Add a note, e.g. “Cash at Salem office, receipt 112”." };

  const profile = await db.profile.findUnique({ where: { id: profileId }, select: { id: true, name: true, userId: true, premiumUntil: true } });
  if (!profile) return { error: "Profile not found." };
  const until = extendPremium(profile.premiumUntil, months);
  const amount = Math.round(amountRupees * 100);
  await db.$transaction([
    db.payment.create({
      data: {
        profileId, plan: plan?.id ?? "manual", months, amount, status: "PAID", paidAt: new Date(),
        offline: true, grantedById: admin.id, demo: false,
      },
    }),
    db.profile.update({ where: { id: profileId }, data: { premiumUntil: until } }),
  ]);
  const untilText = until.toLocaleDateString("en-IN", { dateStyle: "medium" });
  await log(admin.id, "member.grant_premium", profile.userId, `${months} months · ${rupees(amount)} · ${note}`);
  await notifyProfile(profileId, "premium_activated", { name: firstName(profile.name), until: untilText, link: link("/dashboard") });
  revalidatePath(memberPath(profile.userId));
  return { message: `Premium active until ${untilText}.` };
}

const PROFILE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "HIDDEN", "MARRIED"] as const;

export async function setProfileStatus(profileId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const status = str(fd, "status") as (typeof PROFILE_STATUSES)[number];
  if (!PROFILE_STATUSES.includes(status)) return { error: "Choose a status." };
  const reason = str(fd, "reason").slice(0, 300);
  if (status === "REJECTED" && !reason) return { error: "Give a reason so the member can fix their profile." };
  const before = await db.profile.findUnique({ where: { id: profileId }, select: { status: true, name: true, userId: true } });
  if (!before) return { error: "Profile not found." };
  if (before.status === status) return { message: "Status unchanged." };
  await db.profile.update({
    where: { id: profileId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? reason : null,
      marriedAt: status === "MARRIED" ? new Date() : null,
    },
  });
  await log(admin.id, status === "MARRIED" ? "profile.married" : "profile.status", profileId, `${before.status} → ${status}${reason ? ` · ${reason}` : ""}`);
  if (status === "APPROVED") await notifyProfile(profileId, "profile_approved", { name: firstName(before.name), link: link("/dashboard") });
  if (status === "REJECTED") await notifyProfile(profileId, "profile_rejected", { name: firstName(before.name), reason, link: link("/profile/edit") });
  revalidatePath(memberPath(before.userId));
  revalidatePath("/admin", "layout");
  return { message: status === "MARRIED" ? "Marked as married and removed from search." : "Status updated." };
}

export async function eraseAccount(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const t = await targetMember(userId);
  if ("error" in t) return { error: t.error };
  if (str(fd, "confirm") !== "ERASE") return { error: "Type ERASE to confirm." };
  const reason = str(fd, "reason").slice(0, 300);
  if (!reason) return { error: "Record why the account is being erased (e.g. member's request on 12 Oct)." };
  // Logged first: the user row (and everything hanging off it) is gone afterwards. Payments are kept, unlinked.
  await log(admin.id, "member.erase", userId, `${t.user.profile?.code ?? "no profile"} · ${maskPhone(t.user.phone)} · ${reason}`);
  if (t.user.profile) {
    const photos = await db.photo.findMany({ where: { profileId: t.user.profile.id }, select: { id: true } });
    await deletePhotos(photos.map((p) => p.id));
  }
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin", "layout");
  return { redirect: "/admin/members?erased=1" };
}
