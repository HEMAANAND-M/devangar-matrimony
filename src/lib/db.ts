import { PrismaClient } from "@prisma/client";
import { decryptField } from "./field-crypto-core";

const decrypt = (v: string) => decryptField(v);
const decryptOptional = (v: string | null) => (v ? decryptField(v) : null);

/**
 * Phone numbers and email addresses are stored encrypted (see field-crypto-core.ts). This
 * extension decrypts them on every read, including nested selects, so pages use `user.phone` as
 * before. Writes must store `encryptField(...)` plus the matching `phoneHash` / `emailHash`, and
 * lookups must filter on the hash columns.
 */
function createClient() {
  return new PrismaClient().$extends({
    name: "contact-encryption",
    result: {
      user: {
        phone: { needs: { phone: true }, compute: (u) => decrypt(u.phone) },
        email: { needs: { email: true }, compute: (u) => decryptOptional(u.email) },
      },
      familyInvite: {
        phone: { needs: { phone: true }, compute: (i) => decrypt(i.phone) },
      },
      supportTicket: {
        phone: { needs: { phone: true }, compute: (t) => decryptOptional(t.phone) },
        email: { needs: { email: true }, compute: (t) => decryptOptional(t.email) },
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** The client handed to interactive `db.$transaction(async (tx) => …)` callbacks. */
export type Tx = Omit<Db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
