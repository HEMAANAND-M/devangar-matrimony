/**
 * Encrypts contact details stored before v1.8.0 and fills their lookup hashes.
 * Run once after `prisma migrate deploy`:  npm run db:encrypt-contacts
 * Idempotent: rows already encrypted ("v1:" prefix) are only re-hashed if their hash is missing.
 * Uses DATA_ENCRYPTION_KEY (or SESSION_SECRET) from the environment or from .env.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { decryptField, emailFields, encryptField, isEncrypted, normaliseEmail, phoneHash } from "../src/lib/field-crypto-core";

// Next.js loads .env for the app; a standalone script has to do it itself.
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  // No .env: rely on the real environment (CI, hosting).
}

const db = new PrismaClient();

async function main() {
  let users = 0;
  for (const u of await db.user.findMany({ select: { id: true, phone: true, phoneHash: true, email: true, emailHash: true } })) {
    const plainPhone = decryptField(u.phone);
    const plainEmail = u.email ? decryptField(u.email) : null;
    const data: Record<string, string | null> = {};
    if (!isEncrypted(u.phone)) data.phone = encryptField(plainPhone);
    if (!u.phoneHash) data.phoneHash = phoneHash(plainPhone);
    if (plainEmail && (!isEncrypted(u.email) || !u.emailHash)) Object.assign(data, emailFields(normaliseEmail(plainEmail)));
    if (Object.keys(data).length) {
      await db.user.update({ where: { id: u.id }, data });
      users++;
    }
  }
  let invites = 0;
  for (const i of await db.familyInvite.findMany({ select: { id: true, phone: true, phoneHash: true } })) {
    const plain = decryptField(i.phone);
    if (isEncrypted(i.phone) && i.phoneHash) continue;
    await db.familyInvite.update({ where: { id: i.id }, data: { phone: isEncrypted(i.phone) ? i.phone : encryptField(plain), phoneHash: phoneHash(plain) } });
    invites++;
  }
  let tickets = 0;
  for (const t of await db.supportTicket.findMany({ select: { id: true, phone: true, email: true } })) {
    const data: Record<string, string> = {};
    if (t.phone && !isEncrypted(t.phone)) data.phone = encryptField(t.phone);
    if (t.email && !isEncrypted(t.email)) data.email = encryptField(t.email);
    if (Object.keys(data).length) {
      await db.supportTicket.update({ where: { id: t.id }, data });
      tickets++;
    }
  }
  console.log(`Encrypted contact details: ${users} users, ${invites} family invites, ${tickets} support tickets.`);
}

main().finally(() => db.$disconnect());
