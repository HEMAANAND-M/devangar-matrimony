import "server-only";
import type { Prisma } from "@prisma/client";

export type MemberParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const PROFILE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "HIDDEN", "MARRIED"] as const;
const ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;

/** Member search used by the members page and its CSV export. Staff accounts are excluded. */
export function memberWhere(params: MemberParams, now = new Date()): Prisma.UserWhereInput {
  const q = one(params.q);
  const status = one(params.status);
  const account = one(params.account);
  const premium = one(params.premium);
  const verified = one(params.verified);
  const gender = one(params.gender);
  const from = one(params.from);
  const to = one(params.to);
  const flagged = one(params.flagged);

  const profile: Prisma.ProfileWhereInput = {
    ...(status && (PROFILE_STATUSES as readonly string[]).includes(status) ? { status: status as (typeof PROFILE_STATUSES)[number] } : {}),
    ...(premium === "yes" ? { premiumUntil: { gt: now } } : {}),
    ...(premium === "no" ? { OR: [{ premiumUntil: null }, { premiumUntil: { lte: now } }] } : {}),
    ...(verified === "yes" ? { idVerifiedAt: { not: null } } : {}),
    ...(verified === "no" ? { idVerifiedAt: null } : {}),
    ...(gender === "MALE" || gender === "FEMALE" ? { gender } : {}),
    ...(flagged === "yes" ? { NOT: { flags: { isEmpty: true } } } : {}),
    // A specific flag name (e.g. "scam_language"), as linked from the dashboard's safety panel.
    ...(flagged && flagged !== "yes" && /^[a-z_]{3,40}$/.test(flagged) ? { flags: { has: flagged } } : {}),
  };
  const digits = q?.replace(/\D/g, "") ?? "";

  const and: Prisma.UserWhereInput[] = [{ role: "USER" }];
  if (status === "NONE") and.push({ profile: null, managing: null });
  else if (Object.keys(profile).length) and.push({ profile });
  if (account && (ACCOUNT_STATUSES as readonly string[]).includes(account)) and.push({ status: account as (typeof ACCOUNT_STATUSES)[number] });
  if (from || to) {
    and.push({
      createdAt: {
        ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
      },
    });
  }
  if (q) {
    and.push({
      OR: [
        { profile: { name: { contains: q, mode: "insensitive" } } },
        { profile: { code: { equals: q.toUpperCase() } } },
        { profile: { city: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

export const memberSelect = {
  id: true,
  phone: true,
  email: true,
  status: true,
  phoneVerified: true,
  createdAt: true,
  lastLoginAt: true,
  lastActiveAt: true,
  managing: { select: { profile: { select: { code: true } } } },
  profile: {
    select: {
      id: true, code: true, name: true, gender: true, dateOfBirth: true, city: true, status: true,
      premiumUntil: true, idVerifiedAt: true, photoVerifiedAt: true, flags: true,
    },
  },
} satisfies Prisma.UserSelect;
