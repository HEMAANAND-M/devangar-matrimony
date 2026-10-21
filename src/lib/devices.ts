import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { link, notifyUser } from "./notify";
import { createRevokeToken } from "./revoke-token";
import { clientIp } from "./rate-limit";
import { isHttps } from "./session";
import { logSecurity } from "./security-log";

// Long-lived random id per browser: lets members recognise their devices and lets staff spot one
// device behind several accounts. It identifies a browser, not a person, and is never shown raw.
const DEVICE_COOKIE = "dm_device";
const DEVICE_MAX_AGE = 2 * 365 * 24 * 60 * 60;

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${process.env.SESSION_SECRET ?? ""}`).digest("hex");
}

/** Records a successful sign-in. Never throws: a logging failure must not block signing in. */
export async function recordLoginEvent(userId: string) {
  try {
    const jar = await cookies();
    let deviceId = jar.get(DEVICE_COOKIE)?.value;
    if (!deviceId || !/^[a-f0-9]{32}$/.test(deviceId)) {
      deviceId = randomBytes(16).toString("hex");
      jar.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", path: "/", secure: await isHttps(), maxAge: DEVICE_MAX_AGE });
    }
    const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 300);
    const [hasHistory, knownDevice] = await Promise.all([
      db.loginEvent.findFirst({ where: { userId }, select: { id: true } }),
      db.loginEvent.findFirst({ where: { userId, deviceId }, select: { id: true } }),
    ]);
    await db.loginEvent.create({ data: { userId, deviceId, ipHash: hashIp(await clientIp()), userAgent } });
    // A sign-in from a browser this account has never used before is worth telling the member about.
    if (hasHistory && !knownDevice) {
      const time = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
      const { sessionVersion } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
      const token = await createRevokeToken(userId, sessionVersion);
      await logSecurity(userId, "new_device", deviceLabel(userAgent));
      await notifyUser(userId, "new_sign_in", { device: deviceLabel(userAgent), time, link: link(`/security/not-me?t=${encodeURIComponent(token)}`) });
    }
    await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  } catch (e) {
    console.error("[login-event] failed:", e instanceof Error ? e.message : e);
  }
}

/** "Chrome on Android", "Safari on iPhone"… from a user-agent string. */
export function deviceLabel(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}
