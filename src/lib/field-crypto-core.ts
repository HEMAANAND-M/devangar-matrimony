import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Field-level encryption for contact details (phone numbers, email addresses).
 *
 * Root key: DATA_ENCRYPTION_KEY, or one derived from SESSION_SECRET when it is unset. Two keys are
 * derived from it: AES-256-GCM for the stored values, and HMAC-SHA256 for blind indexes, so exact
 * lookups ("find the account for +91…") work without decrypting every row.
 *
 * Plain module (no server-only) so the seed, the backfill script and tests share one derivation.
 * Never change DATA_ENCRYPTION_KEY once set: existing values would become unreadable.
 */
const SALT = "devangar-matrimony";
const PREFIX = "v1:";

type Keys = { enc: Buffer; idx: Buffer };
let cached: { source: string; keys: Keys } | null = null;

export function usingDerivedKey(): boolean {
  return !process.env.DATA_ENCRYPTION_KEY;
}

function keys(): Keys {
  const dedicated = process.env.DATA_ENCRYPTION_KEY;
  const session = process.env.SESSION_SECRET;
  const source = dedicated ? `d:${dedicated}` : `s:${session ?? ""}`;
  if (cached?.source === source) return cached.keys;
  if (dedicated && dedicated.length < 32) throw new Error("DATA_ENCRYPTION_KEY must be at least 32 characters");
  if (!dedicated && (!session || session.length < 32)) throw new Error("Set DATA_ENCRYPTION_KEY (or SESSION_SECRET) to at least 32 characters");
  const root = dedicated
    ? Buffer.from(dedicated, "utf8")
    : Buffer.from(hkdfSync("sha256", Buffer.from(session!, "utf8"), SALT, "field-encryption", 32));
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", root, SALT, info, 32));
  const result = { enc: derive("field-encryption:aes"), idx: derive("field-encryption:index") };
  cached = { source, keys: result };
  return result;
}

export const isEncrypted = (value: string | null | undefined): boolean => !!value && value.startsWith(PREFIX);

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys().enc, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/** Decrypts a stored value. Values that were never encrypted (legacy rows) are returned unchanged. */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", keys().enc, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** Deterministic keyed hash for exact-match lookups. Pass an already normalised value. */
export function blindIndex(normalised: string): string {
  return createHmac("sha256", keys().idx).update(normalised).digest("hex");
}

/** Phones are stored normalised as +91XXXXXXXXXX (see normalizePhone in lib/format). */
export const phoneHash = (normalisedPhone: string) => blindIndex(`phone:${normalisedPhone}`);
export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const emailHash = (email: string) => blindIndex(`email:${normaliseEmail(email)}`);

/** Column values for writing a phone: ciphertext plus its lookup hash. */
export const phoneFields = (normalisedPhone: string) => ({ phone: encryptField(normalisedPhone), phoneHash: phoneHash(normalisedPhone) });
export const emailFields = (email: string | null) =>
  email ? { email: encryptField(normaliseEmail(email)), emailHash: emailHash(email) } : { email: null, emailHash: null };
