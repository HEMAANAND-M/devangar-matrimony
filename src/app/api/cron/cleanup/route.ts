import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 *  - accounts that never verified their number within 7 days and have no profile
 *  - expired one-time codes and rate-limit windows
 *  - sign-in history older than 180 days and security activity older than a year (data minimisation)
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const [unverified, otps, rateLimits, loginEvents, securityEvents] = await Promise.all([
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
    db.securityEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 365 * DAY) } } }),
  ]);
  return Response.json(
    {
      unverifiedAccountsDeleted: unverified.count,
      expiredOtpsDeleted: otps.count,
      rateLimitsDeleted: rateLimits.count,
      loginEventsDeleted: loginEvents.count,
      securityEventsDeleted: securityEvents.count,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
