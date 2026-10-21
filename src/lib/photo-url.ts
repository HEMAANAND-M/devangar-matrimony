import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring photo URLs. Pages only hand these to viewers who passed the access checks, so the
 * photo route can serve a signed request without a session, as a public, CDN-cacheable response.
 *
 * `exp` is rounded up to the next 6-hour boundary, so a URL (and its CDN cache key) stays the same
 * for every page view in that window. A URL therefore lives 6–12 hours and keeps working until then,
 * even if the photo's visibility changes. Deleting a photo makes it 404 straight away.
 */
type Size = "full" | "thumb";
const WINDOW_SECONDS = 6 * 60 * 60;

function key(): string {
  if (process.env.PHOTO_URL_KEY) return process.env.PHOTO_URL_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  return createHash("sha256").update(`photo-url:${secret}`).digest("hex");
}

const sign = (id: string, size: Size, exp: number) =>
  createHmac("sha256", key()).update(`${id}.${size}.${exp}`).digest("hex").slice(0, 32);

export function signedPhotoUrl(photoId: string, size: Size = "full", now = Date.now()): string {
  const exp = (Math.floor(now / 1000 / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
  const q = new URLSearchParams({ ...(size === "thumb" ? { size: "thumb" } : {}), exp: String(exp), sig: sign(photoId, size, exp) });
  return `/api/photos/${photoId}?${q}`;
}

/** "valid" with seconds left, "invalid" for a forged or expired signature, "absent" when unsigned. */
export function checkPhotoSignature(
  photoId: string,
  size: Size,
  exp: string | null,
  sig: string | null,
  now = Date.now(),
): { state: "absent" } | { state: "invalid" } | { state: "valid"; secondsLeft: number } {
  if (exp === null && sig === null) return { state: "absent" };
  const expNum = Number(exp);
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{32}$/.test(sig)) return { state: "invalid" };
  const secondsLeft = expNum - Math.floor(now / 1000);
  // Rejects expired URLs and any expiry further out than the signer would ever issue.
  if (secondsLeft <= 0 || secondsLeft > 2 * WINDOW_SECONDS) return { state: "invalid" };
  const expected = Buffer.from(sign(photoId, size, expNum));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { state: "invalid" };
  return { state: "valid", secondsLeft };
}
