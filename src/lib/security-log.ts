import "server-only";
import { db } from "./db";

export type SecurityKind =
  | "new_device"
  | "password_changed"
  | "password_reset"
  | "signed_out_everywhere"
  | "locked_via_link"
  | "number_shared"
  | "email_changed"
  | "staff_signed_out"
  | "staff_password_reset";

/** Records an event for the member's "Security activity" list. Never throws. */
export async function logSecurity(userId: string, kind: SecurityKind, detail?: string) {
  try {
    await db.securityEvent.create({ data: { userId, kind, detail: detail?.slice(0, 200) } });
  } catch (e) {
    console.error("[security-log] failed:", e instanceof Error ? e.message : e);
  }
}
