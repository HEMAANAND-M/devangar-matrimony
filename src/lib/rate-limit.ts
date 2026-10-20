import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/** Best-effort client IP from the proxy headers set by Vercel / most hosts. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window counter stored in Postgres, so limits hold across serverless instances.
 * Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}

/** Applies every limit; all counters are incremented so a burst cannot dodge one by tripping another. */
export async function rateLimitAll(rules: [key: string, limit: number, windowMs: number][]): Promise<boolean> {
  const results = await Promise.all(rules.map(([k, l, w]) => rateLimit(k, l, w)));
  return results.every(Boolean);
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";
