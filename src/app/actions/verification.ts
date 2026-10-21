"use server";

import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { link, notifyProfile } from "@/lib/notify";
import { MAX_PHOTO_BYTES, processIdDocument } from "@/lib/photos";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireAdmin, requireProfile, requireStaff } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

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
  if (!(await featureEnabled("idVerification"))) return { error: "ID verification is paused at the moment. Please try again later." };
  if (!(await rateLimitAll([[`idv:${profile.id}`, 5, 24 * HOUR]]))) return { error: RATE_LIMITED };

  const docType = str(fd, "docType") as DocType;
  if (!DOC_TYPES.includes(docType)) return { error: "Choose a document type." };
  const last4 = str(fd, "last4").toUpperCase().replace(/\s/g, "");
  if (!LAST4[docType].test(last4)) return { error: "Enter only the last 4 characters of the document number." };
  if (fd.get("consent") !== "on") return { error: "Please confirm consent to continue." };

  const pending = await db.idVerification.findFirst({ where: { profileId: profile.id, status: "PENDING", docType: { not: "SELFIE" } } });
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

/** A selfie that staff compare with the member's approved photos; encrypted and deleted after review. */
export async function submitSelfie(_: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (!(await featureEnabled("photoVerification"))) return { error: "Photo verification is paused at the moment. Please try again later." };
  if (!(await rateLimitAll([[`selfie:${profile.id}`, 5, 24 * HOUR]]))) return { error: RATE_LIMITED };
  if (profile.photoVerifiedAt) return { error: "Your photos are already verified." };
  const approvedPhotos = await db.photo.count({ where: { profileId: profile.id, approved: true } });
  if (!approvedPhotos) return { error: "Add a profile photo and wait for it to be approved first — we compare your selfie with it." };
  const pending = await db.idVerification.findFirst({ where: { profileId: profile.id, status: "PENDING", docType: "SELFIE" } });
  if (pending) return { error: "A selfie is already awaiting review." };
  if (fd.get("consent") !== "on") return { error: "Please confirm consent to continue." };

  const file = fd.get("selfie");
  if (!(file instanceof File) || file.size === 0) return { error: "Take a selfie to continue." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be 5 MB or smaller." };
  const doc = await processIdDocument(Buffer.from(await file.arrayBuffer()));
  if (!doc || doc.mime === "application/pdf") return { error: "Upload a JPEG, PNG or WebP photo." };

  await db.idVerification.create({
    data: { profileId: profile.id, docType: "SELFIE", last4: "", document: new Uint8Array(encrypt(doc.bytes)), documentMime: doc.mime },
  });
  revalidatePath("/verify-photo");
  return { message: "Thanks! Our team will compare your selfie with your photos, then delete it." };
}

/**
 * Approve or reject an ID document (admins only) or a selfie (any staff). Either way the uploaded
 * file is deleted immediately.
 */
export async function reviewVerification(id: string, approve: boolean, rawReason = ""): Promise<FormState> {
  // Role first, so callers without access learn nothing about which verifications exist.
  const staffMember = await requireStaff();
  const reason = rawReason.trim().slice(0, 300);
  if (!approve && !reason) return { error: "Give a reason so the member can resubmit." };
  const v = await db.idVerification.findUnique({
    where: { id },
    select: { docType: true, last4: true, status: true, profileId: true, profile: { select: { name: true } } },
  });
  if (!v) return { error: "Verification no longer exists." };
  const isSelfie = v.docType === "SELFIE";
  const staff = isSelfie ? staffMember : await requireAdmin();
  if (v.status !== "PENDING") return { error: "Already reviewed." };

  const now = new Date();
  await db.$transaction([
    db.idVerification.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED", rejectionReason: approve ? null : reason, document: null, documentMime: null, reviewedAt: now, reviewedById: staff.id },
    }),
    ...(approve ? [db.profile.update({ where: { id: v.profileId }, data: isSelfie ? { photoVerifiedAt: now } : { idVerifiedAt: now } })] : []),
    db.adminLog.create({
      data: {
        adminId: staff.id,
        action: `${isSelfie ? "selfie" : "id"}.${approve ? "approve" : "reject"}`,
        targetId: v.profileId,
        detail: isSelfie ? reason || null : `${v.docType} ••${v.last4}${reason ? ` — ${reason}` : ""}`,
      },
    }),
  ]);
  if (approve) {
    await notifyProfile(v.profileId, isSelfie ? "photo_verified" : "id_verified", { name: v.profile.name.split(" ")[0], link: link("/dashboard") });
  }
  revalidatePath("/admin", "layout");
  return { message: approve ? "Approved" : "Rejected" };
}

/** Form-action variant kept for existing callers. */
export async function reviewIdVerification(id: string, approve: boolean, _: FormState, fd: FormData): Promise<FormState> {
  return reviewVerification(id, approve, str(fd, "reason"));
}
