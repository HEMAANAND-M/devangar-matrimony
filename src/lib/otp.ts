import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import { sendOtpSms } from "./sms";

const TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

/** "verify" covers phone verification and password reset; "staff_login" is the staff second step. */
export type OtpPurpose = "verify" | "staff_login";

type Result = { ok: true } | { ok: false; error: string };

export async function issueOtp(userId: string, phone: string, purpose: OtpPurpose = "verify"): Promise<Result> {
  const last = await db.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a minute before requesting another code." };
  }
  // Caps SMS spend and stops a number being flooded with codes.
  if (!(await rateLimit(`otp:day:${phone}`, 8, 24 * 60 * 60 * 1000))) {
    return { ok: false, error: "Daily limit for codes reached. Please try again tomorrow." };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.otpCode.deleteMany({ where: { userId, purpose } });
  const otp = await db.otpCode.create({
    data: { userId, purpose, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  try {
    await sendOtpSms(phone, code);
  } catch (e) {
    console.error("[sms] OTP delivery failed:", e instanceof Error ? e.message : e);
    // Remove the undelivered code so the cooldown does not block an immediate retry.
    await db.otpCode.delete({ where: { id: otp.id } }).catch(() => {});
    return { ok: false, error: "We couldn't send the SMS right now. Please try again in a moment." };
  }
  return { ok: true };
}

export async function checkOtp(userId: string, code: string, purpose: OtpPurpose = "verify"): Promise<Result> {
  const otp = await db.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) return { ok: false, error: "Code expired. Request a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many attempts. Request a new code." };
  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }
  await db.otpCode.deleteMany({ where: { userId, purpose } });
  return { ok: true };
}

/** Seconds until another code may be requested (for the resend countdown). */
export async function resendWaitSeconds(userId: string, purpose: OtpPurpose = "verify"): Promise<number> {
  const last = await db.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!last) return 0;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000));
}
