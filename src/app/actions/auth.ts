"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { checkOtp, issueOtp } from "@/lib/otp";
import { createSession, destroySession, getCurrentUser } from "@/lib/session";

// Compared against when the phone is unknown, so both paths cost the same.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== str(fd, "confirm")) return { error: "Passwords do not match." };
  if (fd.get("terms") !== "on") return { error: "Please accept the terms to continue." };

  if (await db.user.findUnique({ where: { phone } })) {
    return { error: "This number is already registered. Please log in." };
  }
  const user = await db.user.create({
    data: { phone, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession(user.id);
  await issueOtp(user.id, phone);
  redirect("/verify");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  const user = phone ? await db.user.findUnique({ where: { phone } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Incorrect mobile number or password." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
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
