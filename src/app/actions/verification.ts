"use server";

import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { MAX_PHOTO_BYTES, processIdDocument } from "@/lib/photos";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireAdmin, requireProfile } from "@/lib/session";

const DOC_TYPES = ["AADHAAR", "PAN", "PASSPORT", "VOTER_ID", "DRIVING_LICENCE"] as const;
type DocType = (typeof DOC_TYPES)[number];

/** Last four characters only — the full number is never requested or stored. */
const LAST4: Record<DocType, RegExp> = {
  AADHAAR: /^\d{4}$/,
  PAN: /^\d{4}$|^\d{3}[A-Z]$/,
  PASSPORT: /^[A-Z0-9]{4}$/,
  VOTER_ID: /^[A-Z0-9]{4}$/,
  DRIVING_LICENCE: /^[A-Z0-9]{4}$/,
};

export async function submitIdVerification(_: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (!(await rateLimitAll([[`idv:${profile.id}`, 5, 24 * HOUR]]))) return { error: RATE_LIMITED };

  const docType = str(fd, "docType") as DocType;
  if (!DOC_TYPES.includes(docType)) return { error: "Choose a document type." };
  const last4 = str(fd, "last4").toUpperCase().replace(/\s/g, "");
  if (!LAST4[docType].test(last4)) return { error: "Enter only the last 4 characters of the document number." };
  if (fd.get("consent") !== "on") return { error: "Please confirm consent to continue." };

  const pending = await db.idVerification.findFirst({ where: { profileId: profile.id, status: "PENDING" } });
  if (pending) return { error: "A document is already awaiting review." };

  const file = fd.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Upload a photo or PDF of the document." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "File must be 5 MB or smaller." };
  const doc = await processIdDocument(Buffer.from(await file.arrayBuffer()));
  if (!doc) return { error: "Upload a JPEG, PNG, WebP or PDF file." };

  await db.idVerification.create({
    data: { profileId: profile.id, docType, last4, document: new Uint8Array(encrypt(doc.bytes)), documentMime: doc.mime },
  });
  revalidatePath("/verify-id");
  return { message: "Submitted. Our team will review it shortly, then the document is deleted." };
}

/** Approve or reject; either way the document bytes are deleted immediately. */
export async function reviewIdVerification(id: string, approve: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const reason = str(fd, "reason").slice(0, 300);
  if (!approve && !reason) return { error: "Give a reason so the member can resubmit." };
  const v = await db.idVerification.findUnique({ where: { id } });
  if (!v || v.status !== "PENDING") return { error: "Already reviewed." };

  await db.$transaction([
    db.idVerification.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED", rejectionReason: approve ? null : reason, document: null, documentMime: null, reviewedAt: new Date(), reviewedById: admin.id },
    }),
    ...(approve ? [db.profile.update({ where: { id: v.profileId }, data: { idVerifiedAt: new Date() } })] : []),
    db.adminLog.create({ data: { adminId: admin.id, action: approve ? "id.approve" : "id.reject", targetId: v.profileId, detail: `${v.docType} ••${v.last4}${reason ? ` — ${reason}` : ""}` } }),
  ]);
  revalidatePath("/admin");
  return {};
}
