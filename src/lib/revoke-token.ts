import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * Signed links for "This wasn't me" in new-sign-in alerts. A token names one account and the
 * session version it was issued at, so it stops working once used (the version moves on).
 */
const PURPOSE = "revoke-sessions";

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(`${secret}:${PURPOSE}`);
}

export async function createRevokeToken(userId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ sub: userId, v: sessionVersion, p: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readRevokeToken(token: string): Promise<{ userId: string; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.p !== PURPOSE || typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    return { userId: payload.sub, version: payload.v };
  } catch {
    return null;
  }
}
