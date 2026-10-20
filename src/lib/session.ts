import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

// __Host- cookies must be Secure, host-only and path=/, which blocks subdomain cookie injection.
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-dm_session" : "dm_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string, sessionVersion: number) {
  const token = await new SignJWT({ sub: userId, v: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function readSession(): Promise<{ userId: string; version: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : -1 };
  } catch {
    return null;
  }
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
  const { managing, profile, ...rest } = user;
  return {
    ...rest,
    profile: profile ?? managing?.profile ?? null,
    isFamilyManager: !profile && !!managing,
    managing,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export const isStaff = (user: { role: string }) => user.role === "ADMIN" || user.role === "MODERATOR";

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
  if (!user.profile) redirect("/profile/edit");
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
