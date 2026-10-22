// User clean-up for reset.sh. Phones are encrypted, so pattern matches happen here, after decryption.
import { byPhone, decryptField, sql } from "./db.mjs";

// Numbers registered by the suites all start with +9198 (seeded demo accounts use +9190000…).
const testUsers = sql(`SELECT id || '|' || phone FROM "User"`)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((row) => row.split("|"))
  .filter(([, phone]) => decryptField(phone).startsWith("+9198"))
  .map(([id]) => `'${id}'`);
if (testUsers.length) sql(`DELETE FROM "User" WHERE id IN (${testUsers.join(",")})`);

const demoMembers = ["+919000000100", "+919000000101", "+919000000102", "+919000000103", "+919000000104", "+919000000105"];
sql(`UPDATE "User" SET role = 'USER', status = 'ACTIVE', "statusReason" = NULL, "suspendedUntil" = NULL, email = NULL, "emailHash" = NULL, "emailOptIn" = false WHERE ${byPhone(demoMembers)}`);
