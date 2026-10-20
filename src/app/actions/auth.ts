"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { checkOtp, issueOtp } from "@/lib/otp";
import { HOUR, MINUTE, RATE_LIMITED, clientIp, rateLimitAll } from "@/lib/rate-limit";
import { createSession, destroySession, getCurrentUser, requireUser } from "@/lib/session";

// Compared against when the phone is unknown, so both paths cost the same.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const BCRYPT_ROUNDS = 11;

function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
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
  const user = await db.user.create({
    data: { phone, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), whatsappOptIn: fd.get("whatsapp") === "on" },
  });
  await createSession(user.id, user.sessionVersion);
  await issueOtp(user.id, phone);
  redirect("/verify");
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
  const user = phone ? await db.user.findUnique({ where: { phone } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Incorrect mobile number or password." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, user.sessionVersion);
  if (!user.phoneVerified) {
    await issueOtp(user.id, user.phone);
    redirect("/verify");
  }
  redirect("/dashboard");
}

export async function verifyOtp(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const code = str(fd, "code");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const result = await checkOtp(user.id, code);
  if (!result.ok) return { error: result.error };
  await db.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  redirect(user.profile ? "/dashboard" : "/profile/edit");
}

export async function resendOtp(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = await issueOtp(user.id, user.phone);
  return result.ok ? { message: "A new code has been sent." } : { error: result.error };
}

export async function logout() {
  await destroySession();
  redirect("/");
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
  await createSession(updated.id, updated.sessionVersion);
  redirect("/dashboard");
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
  redirect("/login");
}

/** Permanently removes the account and everything linked to it (profile, photos, interests). */
export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimitAll([[`delete:${user.id}`, 5, 15 * MINUTE]]))) return { error: RATE_LIMITED };
  if (str(fd, "confirmText") !== "DELETE") return { error: "Type DELETE to confirm." };
  if (!(await bcrypt.compare(str(fd, "password"), user.passwordHash))) return { error: "Password is incorrect." };
  await db.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?deleted=1");
}

export async function setWhatsappOptIn(optIn: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { whatsappOptIn: optIn } });
  revalidatePath("/settings");
}
