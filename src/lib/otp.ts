import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

/**
 * Sends an OTP by SMS. Until an SMS provider (MSG91, Twilio, etc.) is wired up,
 * the code is printed to the server console in development.
 */
async function deliverSms(phone: string, code: string) {
  if (process.env.NODE_ENV === "production" && !process.env.SMS_PROVIDER) {
    throw new Error("No SMS provider configured");
  }
  console.log(`[OTP] ${phone}: ${code}`);
}

export async function issueOtp(userId: string, phone: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const last = await db.otpCode.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a minute before requesting another code." };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.otpCode.deleteMany({ where: { userId } });
  await db.otpCode.create({
    data: { userId, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  await deliverSms(phone, code);
  return { ok: true };
}

export async function checkOtp(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const otp = await db.otpCode.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) return { ok: false, error: "Code expired. Request a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many attempts. Request a new code." };
  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }
  await db.otpCode.deleteMany({ where: { userId } });
  return { ok: true };
}
