"use server";

import { randomInt, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MOTHER_TONGUES, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { type FormState, opt } from "@/lib/form";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, UPLOAD_DIR, sniffImage } from "@/lib/photos";
import { requireProfile, requireUser } from "@/lib/session";

/** Optional field: empty input becomes null so updates can clear it. */
const o = <T extends z.ZodTypeAny>(s: T) => s.optional().transform((v) => v ?? null);

const MARITAL = ["NEVER_MARRIED", "DIVORCED", "WIDOWED", "AWAITING_DIVORCE"] as const;

const profileSchema = z
  .object({
    profileFor: z.enum(["SELF", "SON", "DAUGHTER", "BROTHER", "SISTER", "RELATIVE", "FRIEND"]),
    name: z.string().min(2, "Enter the full name").max(80),
    gender: z.enum(["MALE", "FEMALE"]),
    dateOfBirth: z.coerce.date(),
    maritalStatus: z.enum(MARITAL),
    heightCm: o(z.coerce.number().int().min(120).max(230)),
    motherTongue: z.enum(MOTHER_TONGUES as [string, ...string[]]),
    subSect: o(z.string().max(60)),
    gothram: o(z.string().max(60)),
    kuladeivam: o(z.string().max(80)),
    star: o(z.enum(STARS as [string, ...string[]])),
    rasi: o(z.enum(RASIS as [string, ...string[]])),
    dosham: z.enum(["NO", "YES", "DONT_KNOW"]),
    birthPlace: o(z.string().max(80)),
    birthTime: o(z.string().max(20)),
    education: z.string().min(2, "Enter education").max(120),
    occupation: z.string().min(2, "Enter occupation").max(120),
    annualIncome: o(z.string().max(40)),
    city: z.string().min(2, "Enter city").max(60),
    state: z.string().min(2).max(60),
    country: z.string().min(2).max(60),
    fatherOccupation: o(z.string().max(80)),
    motherOccupation: o(z.string().max(80)),
    siblings: o(z.string().max(200)),
    about: o(z.string().max(1500)),
    prefAgeMin: o(z.coerce.number().int().min(18).max(80)),
    prefAgeMax: o(z.coerce.number().int().min(18).max(80)),
    prefMaritalStatus: z.array(z.enum(MARITAL)),
    prefNotes: o(z.string().max(500)),
    photoVisibility: z.enum(["ALL_MEMBERS", "ACCEPTED_ONLY"]),
  })
  .refine((p) => ageFrom(p.dateOfBirth) >= (p.gender === "MALE" ? 21 : 18), {
    message: "Legal marriage age is 21 for men and 18 for women.",
  })
  .refine((p) => !p.prefAgeMin || !p.prefAgeMax || p.prefAgeMin <= p.prefAgeMax, {
    message: "Preferred minimum age must not exceed the maximum.",
  });

const FIELDS = [
  "profileFor", "name", "gender", "dateOfBirth", "maritalStatus", "heightCm", "motherTongue", "subSect",
  "gothram", "kuladeivam", "star", "rasi", "dosham", "birthPlace", "birthTime", "education", "occupation",
  "annualIncome", "city", "state", "country", "fatherOccupation", "motherOccupation", "siblings", "about",
  "prefAgeMin", "prefAgeMax", "prefNotes", "photoVisibility",
] as const;

// Changing these on an approved profile sends it back for moderation.
const MODERATED: (keyof z.infer<typeof profileSchema>)[] = ["name", "gender", "dateOfBirth", "about"];

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((f) => [f, opt(fd, f)]));
  raw.prefMaritalStatus = fd.getAll("prefMaritalStatus").filter((v) => typeof v === "string");

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const data = parsed.data;

  const existing = user.profile;
  if (existing) {
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""));
    const changed = MODERATED.some((k) => norm(existing[k as keyof typeof existing]) !== norm(data[k]));
    const status = existing.status === "APPROVED" && !changed ? "APPROVED" : existing.status === "HIDDEN" ? "HIDDEN" : "PENDING";
    await db.profile.update({ where: { id: existing.id }, data: { ...data, status, rejectionReason: null } });
    revalidatePath("/", "layout");
    return { message: status === "PENDING" ? "Saved. Your changes will be reviewed shortly." : "Profile saved." };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.profile.create({ data: { ...data, userId: user.id, code: `DM${randomInt(10000, 100000)}` } });
      break;
    } catch (e) {
      const codeClash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!codeClash || attempt === 4) throw e;
    }
  }
  redirect("/photos?welcome=1");
}

export async function setProfileHidden(hidden: boolean) {
  const { profile } = await requireProfile();
  if (profile.status !== "APPROVED" && profile.status !== "HIDDEN") return;
  await db.profile.update({ where: { id: profile.id }, data: { status: hidden ? "HIDDEN" : "APPROVED" } });
  revalidatePath("/dashboard");
}

export async function uploadPhoto(_: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be 5 MB or smaller." };

  const count = await db.photo.count({ where: { profileId: profile.id } });
  if (count >= MAX_PHOTOS) return { error: `You can upload up to ${MAX_PHOTOS} photos.` };

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return { error: "Only JPEG, PNG or WebP images are allowed." };

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${kind.ext}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), buf);
  await db.photo.create({
    data: { profileId: profile.id, fileName, mimeType: kind.mime, isPrimary: count === 0 },
  });
  revalidatePath("/photos");
  return { message: "Uploaded. The photo will be visible to others after review." };
}

async function ownPhoto(photoId: string) {
  const { profile } = await requireProfile();
  const photo = await db.photo.findFirst({ where: { id: photoId, profileId: profile.id } });
  if (!photo) throw new Error("Photo not found");
  return photo;
}

export async function deletePhoto(photoId: string) {
  const photo = await ownPhoto(photoId);
  await db.photo.delete({ where: { id: photo.id } });
  await unlink(path.join(UPLOAD_DIR, photo.fileName)).catch(() => {});
  if (photo.isPrimary) {
    const next = await db.photo.findFirst({ where: { profileId: photo.profileId }, orderBy: { createdAt: "asc" } });
    if (next) await db.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  revalidatePath("/photos");
}

export async function makePrimaryPhoto(photoId: string) {
  const photo = await ownPhoto(photoId);
  await db.$transaction([
    db.photo.updateMany({ where: { profileId: photo.profileId }, data: { isPrimary: false } }),
    db.photo.update({ where: { id: photo.id }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/photos");
}
