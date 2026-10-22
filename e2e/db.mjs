import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * Direct SQL for test setup and assertions.
 * PSQL: psql binary (default: newest C:\Program Files\PostgreSQL\<version> on Windows, else "psql" on PATH).
 * E2E_DATABASE_URL: the local test database (never point this at production).
 */
function findPsql() {
  if (process.env.PSQL) return process.env.PSQL;
  if (process.platform !== "win32") return "psql";
  const root = "C:/Program Files/PostgreSQL";
  const found = fs.existsSync(root)
    ? fs.readdirSync(root).sort((a, b) => Number(b) - Number(a)).map((v) => `${root}/${v}/bin/psql.exe`).find((p) => fs.existsSync(p))
    : undefined;
  return found ?? "psql";
}

export const PSQL = findPsql();
export const DATABASE_URL = process.env.E2E_DATABASE_URL || "postgresql://postgres:devangar_local@localhost:5432/devangar_matrimony";

/** Runs one statement and returns its unaligned, tuples-only output, trimmed. */
export const sql = (query) => execFileSync(PSQL, ["-d", DATABASE_URL, "-tAc", query]).toString().trim();

// ── Encrypted contact details ────────────────────────────────────────────────
// Phone numbers and emails are stored encrypted, with keyed hashes for lookups. This mirrors
// src/lib/field-crypto-core.ts so suites can find users by number. The key comes from
// DATA_ENCRYPTION_KEY or SESSION_SECRET in the environment, else from the project's .env.
import { createDecipheriv, createHmac, hkdfSync } from "node:crypto";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
    const m = env.match(new RegExp(`^\s*${name}\s*=\s*"?(.*?)"?\s*$`, "m"));
    return m?.[1] || undefined;
  } catch {
    return undefined;
  }
}

let fieldKeys;
function keys() {
  if (fieldKeys) return fieldKeys;
  const dedicated = envValue("DATA_ENCRYPTION_KEY");
  const root = dedicated
    ? Buffer.from(dedicated, "utf8")
    : Buffer.from(hkdfSync("sha256", Buffer.from(envValue("SESSION_SECRET") ?? "", "utf8"), "devangar-matrimony", "field-encryption", 32));
  const derive = (info) => Buffer.from(hkdfSync("sha256", root, "devangar-matrimony", info, 32));
  fieldKeys = { enc: derive("field-encryption:aes"), idx: derive("field-encryption:index") };
  return fieldKeys;
}

/** Lookup hash for a normalised +91XXXXXXXXXX number, matching User."phoneHash". */
export const phoneHash = (phone) => createHmac("sha256", keys().idx).update(`phone:${phone}`).digest("hex");

/** SQL condition selecting users by phone number(s), e.g. `WHERE ${byPhone("+919000000101")}`. */
export const byPhone = (...phones) => `"phoneHash" IN (${phones.flat().map((p) => `'${phoneHash(p)}'`).join(",")})`;

/** Decrypts a stored "v1:…" value (plain values are returned unchanged). */
export function decryptField(stored) {
  if (!stored?.startsWith("v1:")) return stored;
  const raw = Buffer.from(stored.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", keys().enc, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** Same as byPhone, qualified with a table alias (for queries joining "User" more than once). */
export const byPhoneOf = (alias, ...phones) => `${alias}."phoneHash" IN (${phones.flat().map((p) => `'${phoneHash(p)}'`).join(",")})`;
