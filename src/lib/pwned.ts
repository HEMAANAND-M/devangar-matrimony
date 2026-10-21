import "server-only";
import { createHash } from "node:crypto";

/**
 * True when the password appears in a known data breach (Have I Been Pwned "range" API). Only the
 * first 5 characters of its SHA-1 hash leave the server, so the password itself is never sent.
 * Fails open: if the service is slow or unreachable, sign-up is not blocked.
 * On by default in production; PWNED_PASSWORD_CHECK=off disables it, =on forces it in development.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const setting = process.env.PWNED_PASSWORD_CHECK;
  if (setting === "off" || (setting !== "on" && process.env.NODE_ENV !== "production")) return false;
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "devangar-matrimony" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export const BREACHED_PASSWORD =
  "This password has appeared in a known data breach, so it is easy for others to guess. Please choose a different one.";
