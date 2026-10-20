import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Key for encrypting ID documents at rest. A dedicated ID_DOC_KEY is preferred; otherwise one is
 * derived from SESSION_SECRET with HKDF so the two keys are never the same bytes.
 */
function docKey(): Buffer {
  const material = process.env.ID_DOC_KEY ?? process.env.SESSION_SECRET;
  if (!material || material.length < 32) throw new Error("ID_DOC_KEY or SESSION_SECRET must be at least 32 characters");
  return Buffer.from(hkdfSync("sha256", material, "devangar-matrimony", "id-document-v1", 32));
}

/** AES-256-GCM. Output layout: 12-byte IV | 16-byte auth tag | ciphertext. */
export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", docKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", docKey(), blob.subarray(0, 12));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

/** Constant-time comparison of a hex HMAC-SHA256 signature. */
export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
