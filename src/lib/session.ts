import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

// Over HTTPS the cookie is __Host- prefixed: Secure, host-only and path=/, which blocks subdomain
// cookie injection. Over plain HTTP (local `next start`, LAN testing) browsers reject Secure cookies,
// so a normal cookie is used instead. Both names are read and cleared.
export const SECURE_COOKIE = "__Host-dm_session";
export const PLAIN_COOKIE = "dm_session";
// Staff who passed the password step but not yet the SMS code.
const PENDING_SECURE_COOKIE = "__Host-dm_staff_pending";
const PENDING_PLAIN_COOKIE = "dm_staff_pending";
const MAX_AGE = 60 * 60 * 24 * 30;
const PENDING_MAX_AGE = 10 * 60;

/** Staff are signed out after this long without any request. */
export const STAFF_IDLE_MS = 30 * 60 * 1000;
// lastActiveAt is written at most this often, so browsing does not write on every request.
const STAFF_TOUCH_MS = 60 * 1000;
const MEMBER_TOUCH_MS = 5 * 60 * 1000;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

/** True when this request reached us over HTTPS (Vercel and most proxies set x-forwarded-proto). */
export async function isHttps(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  return process.env.NODE_ENV === "production" && proto === "https";
}

const baseOptions = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function createSession(userId: string, sessionVersion: number) {
  const token = await new SignJWT({ sub: userId, v: sessionVersion, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  const secure = await isHttps();
  const jar = await cookies();
  await destroySession();
  jar.set(secure ? SECURE_COOKIE : PLAIN_COOKIE, token, { ...baseOptions, secure, maxAge: MAX_AGE });
  // A fresh sign-in counts as activity, so the staff idle timeout starts now.
  await db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
}

/**
 * Expires both cookie names. A deletion must repeat the attributes the cookie was set with —
 * browsers ignore a __Host- cookie update that is not Secure, which previously left members
 * logged in after "Log out".
 */
export async function destroySession() {
  const jar = await cookies();
  jar.set(SECURE_COOKIE, "", { ...baseOptions, secure: true, maxAge: 0 });
  jar.set(PLAIN_COOKIE, "", { ...baseOptions, secure: false, maxAge: 0 });
}

async function readSession(): Promise<{ userId: string; version: number } | null> {
  const jar = await cookies();
  const token = jar.get(SECURE_COOKIE)?.value || jar.get(PLAIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    // Tokens issued before `typ` existed are sessions; a staff-pending token never is.
    if (payload.typ !== undefined && payload.typ !== "session") return null;
    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : -1 };
  } catch {
    return null;
  }
}

/** Marks a staff member as having passed the password step; the SMS code completes sign-in. */
export async function createStaffPending(userId: string) {
  const token = await new SignJWT({ sub: userId, typ: "staff_pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE}s`)
    .sign(key());
  const secure = await isHttps();
  await clearStaffPending();
  (await cookies()).set(secure ? PENDING_SECURE_COOKIE : PENDING_PLAIN_COOKIE, token, { ...baseOptions, secure, maxAge: PENDING_MAX_AGE });
}

export async function readStaffPending(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_SECURE_COOKIE)?.value || jar.get(PENDING_PLAIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "staff_pending" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function clearStaffPending() {
  const jar = await cookies();
  jar.set(PENDING_SECURE_COOKIE, "", { ...baseOptions, secure: true, maxAge: 0 });
  jar.set(PENDING_PLAIN_COOKIE, "", { ...baseOptions, secure: false, maxAge: 0 });
}

export const isStaff = (user: { role: string }) => user.role === "ADMIN" || user.role === "MODERATOR";

type StatusFields = { status: string; statusReason: string | null; suspendedUntil: Date | null };

/**
 * Why this account may not sign in, or null when it may. An expired suspension is lifted here,
 * so it needs no scheduled job.
 */
export async function accountBlock(user: StatusFields & { id: string }): Promise<string | null> {
  const reason = user.statusReason?.trim().replace(/[.\s]*$/, ".");
  if (user.status === "BANNED") {
    return `This account has been closed${reason ? `: ${reason}` : "."} If you think this is a mistake, contact us through the Support page.`;
  }
  if (user.status === "SUSPENDED") {
    if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
      await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE", statusReason: null, suspendedUntil: null } });
      return null;
    }
    const until = user.suspendedUntil
      ? ` until ${user.suspendedUntil.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}`
      : "";
    return `Your account is suspended${until}.${reason ? ` Reason: ${reason}` : ""} Contact us through the Support page if you need help.`;
  }
  return null;
}

/**
 * Current user, memoised per request so layout + page share one query.
 * `profile` is the member's own profile or, for a family member, the profile they manage;
 * `isFamilyManager` tells the two apart.
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { profile: true, managing: { include: { profile: true } } },
  });
  // Reject sessions issued before a password change or "log out everywhere".
  if (!user || user.sessionVersion !== session.version) return null;
  if (await accountBlock(user)) return null;

  const staff = isStaff(user);
  const now = Date.now();
  const lastActive = user.lastActiveAt?.getTime() ?? 0;
  if (staff && now - lastActive > STAFF_IDLE_MS) return null;
  if (now - lastActive > (staff ? STAFF_TOUCH_MS : MEMBER_TOUCH_MS)) {
    after(() => db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).then(() => {}, () => {}));
  }

  const { managing, profile, ...rest } = user;
  return {
    ...rest,
    profile: profile ?? managing?.profile ?? null,
    isFamilyManager: !profile && !!managing,
    managing,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Where a signed-in account belongs. Staff always start in the admin portal, even if they also have a member profile. */
export function homePath(user: { role: string }, hasProfile: boolean): string {
  if (isStaff(user)) return "/admin";
  return hasProfile ? "/dashboard" : "/profile/edit";
}

/** Signed-in user with a verified phone; redirects otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.phoneVerified) redirect("/verify");
  return user;
}

/** Signed-in user with a profile; redirects to profile creation otherwise. */
export async function requireProfile() {
  const user = await requireUser();
  if (!user.profile) redirect(homePath(user, false));
  return { user, profile: user.profile };
}

/** Admins and moderators: profile, photo and report moderation. */
export async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/dashboard");
  return user;
}

/** Admins only: payments, ID documents, staff management and the audit log. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
