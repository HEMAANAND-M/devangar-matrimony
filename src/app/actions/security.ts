"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { tm } from "@/lib/i18n";
import { HOUR, RATE_LIMITED, clientIp, rateLimitAll } from "@/lib/rate-limit";
import { readRevokeToken } from "@/lib/revoke-token";
import { destroySession } from "@/lib/session";

/**
 * "This wasn't me" from a new-sign-in alert: signs out every device and replaces the password
 * with a random one, because whoever signed in may know it. The owner sets a new password with
 * an SMS code sent to their own phone.
 */
export async function revokeFromLink(token: string): Promise<FormState> {
  if (!(await rateLimitAll([[`revoke:ip:${await clientIp()}`, 10, HOUR]]))) return { error: await tm(RATE_LIMITED) };
  const claim = await readRevokeToken(token);
  if (!claim) return { error: await tm("This link has expired or was already used.") };
  const locked = await db.user.updateMany({
    where: { id: claim.userId, sessionVersion: claim.version },
    data: { sessionVersion: { increment: 1 }, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12) },
  });
  if (!locked.count) return { error: await tm("This link has expired or was already used.") };
  await destroySession();
  return { redirect: "/forgot-password?locked=1" };
}
