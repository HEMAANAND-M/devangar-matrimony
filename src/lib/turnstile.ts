import "server-only";
import { clientIp } from "./rate-limit";

/**
 * Cloudflare Turnstile bot protection for sign-up, login, password reset and the public contact
 * form. Off unless both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set.
 */
export const turnstileSiteKey = () => (process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY) || null;

export const TURNSTILE_FAILED = "Please complete the security check and try again.";

/** True when Turnstile is off, or the form carries a valid, unused token. */
export async function verifyTurnstile(fd: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.TURNSTILE_SITE_KEY) return true;
  const token = fd.get("cf-turnstile-response");
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: await clientIp() }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    // Fail closed: a bot check that cannot be verified must not let traffic through.
    console.error("[turnstile] verification failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
