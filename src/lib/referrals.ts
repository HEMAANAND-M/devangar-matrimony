import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { SITE_URL } from "./site";

// No 0/O, 1/I/L: codes are read aloud and typed from WhatsApp forwards.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

const generate = () => Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** The user's referral code, created on first use. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generate();
    try {
      const { count } = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (count) return code;
      // Another request set a code first: use that one.
      const again = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
      if (again?.referralCode) return again.referralCode;
      throw new Error("User not found");
    } catch (e) {
      // P2002: code collision with another account, try another.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw new Error("Could not allocate a referral code");
}

export const normalizeReferralCode = (raw: string | null | undefined) => {
  const code = (raw ?? "").trim().toUpperCase();
  return code.length === LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
};

/** Account id for a referral code, for registration (?ref=CODE). */
export async function findReferrer(raw: string | null | undefined): Promise<string | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const user = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  return user?.id ?? null;
}

export async function referralStats(userId: string) {
  const [joined, approved] = await Promise.all([
    db.user.count({ where: { referredById: userId, phoneVerified: true } }),
    db.user.count({ where: { referredById: userId, profile: { status: { in: ["APPROVED", "MARRIED"] } } } }),
  ]);
  return { joined, approved };
}

export const referralLink = (code: string) => `${SITE_URL}/register?ref=${code}`;
