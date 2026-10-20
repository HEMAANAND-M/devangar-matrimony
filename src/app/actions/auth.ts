"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { recordLoginEvent } from "@/lib/devices";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { checkOtp, issueOtp } from "@/lib/otp";
import { HOUR, MINUTE, RATE_LIMITED, clientIp, rateLimitAll } from "@/lib/rate-limit";
import {
  accountBlock, clearStaffPending, createSession, createStaffPending, destroySession, getCurrentUser, homePath, isStaff,
  readStaffPending, requireUser,
} from "@/lib/session";
import { featureEnabled } from "@/lib/settings";
import { deletePhotos } from "@/lib/storage";

// Compared against when the phone is unknown, so both paths cost the same.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const BCRYPT_ROUNDS = 11;
const TIMED_OUT = "Your sign-in timed out. Please log in again.";

/** Staff sign-in needs an SMS code after the password unless STAFF_2FA=off (local demos only). */
const staffTwoFactor = () => process.env.STAFF_2FA !== "off";

function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await featureEnabled("registrations"))) {
    return { error: "New registrations are paused for a short while. Please try again later." };
  }
  const ip = await clientIp();
  if (!(await rateLimitAll([[`register:ip:${ip}`, 5, HOUR]]))) return { error: RATE_LIMITED };

  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };
  const problem = passwordProblem(password, str(fd, "confirm"));
  if (problem) return { error: problem };
  if (fd.get("terms") !== "on") return { error: "Please accept the terms to continue." };

  if (await db.user.findUnique({ where: { phone } })) {
    return { error: "This number is already registered. Please log in." };
  }
  const ref = str(fd, "ref").toUpperCase().slice(0, 32);
  const referrer = ref ? await db.user.findUnique({ where: { referralCode: ref }, select: { id: true } }) : null;
  const user = await db.user.create({
    data: {
      phone,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      whatsappOptIn: fd.get("whatsapp") === "on",
      referredById: referrer?.id,
    },
  });
  await createSession(user.id, user.sessionVersion);
  await recordLoginEvent(user.id);
  // An SMS failure is not fatal here: the verify page offers "Resend".
  await issueOtp(user.id, phone);
  return { redirect: "/verify" };
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const ip = await clientIp();
  // Per-IP stops sweeping many accounts; per-phone stops guessing one account from many IPs.
  const allowed = await rateLimitAll([
    [`login:ip:${ip}`, 20, 15 * MINUTE],
    [`login:phone:${phone ?? "invalid"}`, 8, 15 * MINUTE],
  ]);
  if (!allowed) return { error: RATE_LIMITED };

  const password = str(fd, "password");
  const user = phone ? await db.user.findUnique({ where: { phone }, include: { profile: { select: { id: true } }, managing: { select: { id: true } } } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Incorrect mobile number or password." };
  const blocked = await accountBlock(user);
  if (blocked) return { error: blocked };

  if (!user.phoneVerified) {
    await createSession(user.id, user.sessionVersion);
    await recordLoginEvent(user.id);
    await issueOtp(user.id, user.phone);
    return { redirect: "/verify" };
  }
  if (isStaff(user) && staffTwoFactor()) {
    const sent = await issueOtp(user.id, user.phone, "staff_login");
    // Within the resend cooldown the previous code is still valid, so carry on to the code page.
    if (!sent.ok && !sent.error.startsWith("Please wait")) return { error: sent.error };
    await destroySession();
    await createStaffPending(user.id);
    return { redirect: "/login/staff" };
  }
  await createSession(user.id, user.sessionVersion);
  await recordLoginEvent(user.id);
  return { redirect: homePath(user, !!(user.profile || user.managing)) };
}

/** Second step of staff sign-in: the SMS code sent after a correct password. */
export async function verifyStaffLogin(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await readStaffPending();
  if (!userId) return { error: TIMED_OUT, redirect: "/login" };
  if (!(await rateLimitAll([[`staff-otp:${userId}`, 10, 15 * MINUTE]]))) return { error: RATE_LIMITED };
  const code = str(fd, "code");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !isStaff(user)) return { error: TIMED_OUT, redirect: "/login" };
  const blocked = await accountBlock(user);
  if (blocked) return { error: blocked };
  const result = await checkOtp(user.id, code, "staff_login");
  if (!result.ok) return { error: result.error };

  await clearStaffPending();
  await createSession(user.id, user.sessionVersion);
  await recordLoginEvent(user.id);
  const hasProfile = !!(await db.profile.findUnique({ where: { userId: user.id }, select: { id: true } }));
  return { redirect: homePath(user, hasProfile) };
}

export async function resendStaffOtp(): Promise<FormState> {
  const userId = await readStaffPending();
  if (!userId) return { error: TIMED_OUT, redirect: "/login" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } });
  if (!user) return { error: TIMED_OUT, redirect: "/login" };
  const result = await issueOtp(user.id, user.phone, "staff_login");
  return result.ok ? { message: "A new code has been sent." } : { error: result.error };
}

export async function verifyOtp(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const code = str(fd, "code");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const result = await checkOtp(user.id, code);
  if (!result.ok) return { error: result.error };
  await db.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  return { redirect: homePath(user, !!user.profile) };
}

export async function resendOtp(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = await issueOtp(user.id, user.phone);
  return result.ok ? { message: "A new code has been sent." } : { error: result.error };
}

/**
 * "Wrong number?" on the verify page: removes the just-created, never-verified account so the
 * person can register again with the right number.
 */
export async function startOver(): Promise<FormState> {
  const user = await getCurrentUser();
  if (user && !user.phoneVerified && !user.profile && !isStaff(user)) {
    await db.user.delete({ where: { id: user.id } });
  }
  await destroySession();
  return { redirect: "/register" };
}

/** Clears the session; the caller then does a full page load so no cached member page survives. */
export async function logout() {
  await destroySession();
}

/** Step 1 of reset: always answers the same way so it cannot reveal which numbers are registered. */
export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimitAll([[`reset:ip:${ip}`, 10, HOUR]]))) return { error: RATE_LIMITED };
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };

  const user = await db.user.findUnique({ where: { phone } });
  if (user) await issueOtp(user.id, phone);
  redirect(`/reset-password?phone=${encodeURIComponent(phone.slice(3))}`);
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const ip = await clientIp();
  const allowed = await rateLimitAll([
    [`reset-verify:ip:${ip}`, 20, HOUR],
    [`reset-verify:phone:${phone ?? "invalid"}`, 10, HOUR],
  ]);
  if (!allowed) return { error: RATE_LIMITED };

  const code = str(fd, "code");
  const password = str(fd, "password");
  if (!phone || !/^\d{6}$/.test(code)) return { error: "Enter your mobile number and the 6-digit code." };
  const problem = passwordProblem(password, str(fd, "confirm"));
  if (problem) return { error: problem };

  const user = await db.user.findUnique({ where: { phone } });
  if (!user) return { error: "Incorrect or expired code." };
  const result = await checkOtp(user.id, code);
  if (!result.ok) return { error: result.error };

  // Possession of the phone also proves it is verified. Bumping the version signs out every other device.
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), phoneVerified: true, sessionVersion: { increment: 1 } },
  });
  const blocked = await accountBlock(updated);
  if (blocked) return { error: `Password changed. ${blocked}` };
  await createSession(updated.id, updated.sessionVersion);
  await recordLoginEvent(updated.id);
  return { redirect: homePath(updated, !!(await db.profile.findUnique({ where: { userId: updated.id }, select: { id: true } }))) };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimitAll([[`change-pw:${user.id}`, 5, 15 * MINUTE]]))) return { error: RATE_LIMITED };
  if (!(await bcrypt.compare(str(fd, "current"), user.passwordHash))) return { error: "Current password is incorrect." };
  const password = str(fd, "password");
  const problem = passwordProblem(password, str(fd, "confirm"));
  if (problem) return { error: problem };

  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), sessionVersion: { increment: 1 } },
  });
  await createSession(updated.id, updated.sessionVersion);
  return { message: "Password changed. Other devices have been signed out." };
}

export async function logoutEverywhere() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await destroySession();
}

/** Permanently removes the account and everything linked to it (profile, photos, interests). */
export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimitAll([[`delete:${user.id}`, 5, 15 * MINUTE]]))) return { error: RATE_LIMITED };
  if (str(fd, "confirmText") !== "DELETE") return { error: "Type DELETE to confirm." };
  if (!(await bcrypt.compare(str(fd, "password"), user.passwordHash))) return { error: "Password is incorrect." };
  // A family manager's login is deleted without touching the profile they manage.
  const photos = user.isFamilyManager ? [] : await db.photo.findMany({ where: { profile: { userId: user.id } }, select: { id: true } });
  await db.user.delete({ where: { id: user.id } });
  await deletePhotos(photos.map((p) => p.id));
  await destroySession();
  return { redirect: "/?deleted=1" };
}

export async function setWhatsappOptIn(optIn: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { whatsappOptIn: optIn } });
  revalidatePath("/settings");
}
