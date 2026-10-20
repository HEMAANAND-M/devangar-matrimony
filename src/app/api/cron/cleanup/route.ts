import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 *  - accounts that never verified their number within 7 days and have no profile
 *  - expired one-time codes and rate-limit windows
 *  - sign-in history older than 180 days (data minimisation)
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const [unverified, otps, rateLimits, loginEvents] = await Promise.all([
    db.user.deleteMany({
      where: {
        phoneVerified: false,
        role: "USER",
        createdAt: { lt: new Date(now - 7 * DAY) },
        profile: { is: null },
        managing: { is: null },
      },
    }),
    db.otpCode.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now) } } }),
    db.loginEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 180 * DAY) } } }),
  ]);
  return Response.json(
    {
      unverifiedAccountsDeleted: unverified.count,
      expiredOtpsDeleted: otps.count,
      rateLimitsDeleted: rateLimits.count,
      loginEventsDeleted: loginEvents.count,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
