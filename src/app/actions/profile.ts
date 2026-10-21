"use server";

import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  COMPLEXION_OPTIONS, DIET_OPTIONS, FAMILY_STATUS_OPTIONS, FAMILY_TYPE_OPTIONS, LANGUAGES, MOTHER_TONGUES, RASIS, STARS,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { type FormState, opt } from "@/lib/form";
import { MAX_HOROSCOPE_BYTES, processHoroscope } from "@/lib/horoscope";
import { findContactInfo } from "@/lib/moderation";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, processPhoto } from "@/lib/photos";
import { averageHash } from "@/lib/flags";
import { deletePhoto as deleteStoredPhoto, putPhoto } from "@/lib/storage";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireProfile, requireUser } from "@/lib/session";
import { tm } from "@/lib/i18n";

/** Optional field: empty input becomes null so updates can clear it. */
const o = <T extends z.ZodTypeAny>(s: T) => s.optional().transform((v) => v ?? null);

const MARITAL = ["NEVER_MARRIED", "DIVORCED", "WIDOWED", "AWAITING_DIVORCE"] as const;
const DOSHAM = ["NO", "YES", "DONT_KNOW"] as const;
const oneOf = (list: string[]) => z.enum(list as [string, ...string[]]);

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
    dosham: z.enum(DOSHAM),
    birthPlace: o(z.string().max(80)),
    birthTime: o(z.string().max(20)),
    lagnam: o(oneOf(RASIS)),
    education: z.string().min(2, "Enter education").max(120),
    occupation: z.string().min(2, "Enter occupation").max(120),
    annualIncome: o(z.string().max(40)),
    city: z.string().min(2, "Enter city").max(60),
    state: z.string().min(2).max(60),
    country: z.string().min(2).max(60),
    fatherOccupation: o(z.string().max(80)),
    motherOccupation: o(z.string().max(80)),
    siblings: o(z.string().max(200)),
    fatherName: o(z.string().max(80)),
    motherName: o(z.string().max(80)),
    familyType: o(oneOf(FAMILY_TYPE_OPTIONS)),
    familyStatus: o(oneOf(FAMILY_STATUS_OPTIONS)),
    nativePlace: o(z.string().max(80)),
    about: o(z.string().max(1500)),
    diet: o(oneOf(DIET_OPTIONS)),
    complexion: o(oneOf(COMPLEXION_OPTIONS)),
    languages: z.array(oneOf(LANGUAGES)).max(LANGUAGES.length),
    prefAgeMin: o(z.coerce.number().int().min(18).max(80)),
    prefAgeMax: o(z.coerce.number().int().min(18).max(80)),
    prefMaritalStatus: z.array(z.enum(MARITAL)),
    prefNotes: o(z.string().max(500)),
    prefExcludeOwnGothram: z.boolean(),
    prefStars: z.array(oneOf(STARS)).max(STARS.length),
    prefDosham: o(z.enum(DOSHAM)),
    prefCities: z.array(z.string().min(2).max(60)).max(30),
    prefEducation: o(z.string().max(80)),
    photoVisibility: z.enum(["ALL_MEMBERS", "ACCEPTED_ONLY"]),
    horoscopeVisibility: z.enum(["ALL_MEMBERS", "ACCEPTED_ONLY"]),
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
  "prefAgeMin", "prefAgeMax", "prefNotes", "photoVisibility", "lagnam", "fatherName", "motherName", "familyType",
  "familyStatus", "nativePlace", "diet", "complexion", "prefDosham", "prefEducation", "horoscopeVisibility",
] as const;

const list = (fd: FormData, key: string) =>
  fd.getAll(key).filter((v): v is string => typeof v === "string" && !!v.trim()).map((v) => v.trim());

// Changing these on an approved profile sends it back for moderation.
const MODERATED: (keyof z.infer<typeof profileSchema>)[] = ["name", "gender", "dateOfBirth", "about"];

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((f) => [f, opt(fd, f)]));
  raw.prefMaritalStatus = list(fd, "prefMaritalStatus");
  raw.languages = list(fd, "languages");
  raw.prefStars = list(fd, "prefStars");
  // Cities ticked from the list plus any typed in, comma-separated.
  raw.prefCities = [...new Set([...list(fd, "prefCities"), ...opt(fd, "prefCitiesOther")?.split(",").map((c) => c.trim()).filter(Boolean) ?? []])];
  // A hidden "0" precedes the checkbox, so the last value is the checkbox state.
  raw.prefExcludeOwnGothram = list(fd, "prefExcludeOwnGothram").at(-1) !== "0";
  raw.horoscopeVisibility ??= "ACCEPTED_ONLY";

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: await tm(parsed.error.issues[0]?.message ?? "Please check the form.") };
  const data = parsed.data;
  for (const field of ["about", "siblings", "prefNotes", "fatherOccupation", "motherOccupation", "fatherName", "motherName", "nativePlace"] as const) {
    const found = findContactInfo(data[field]);
    if (found) return { error: await tm(`Please remove ${found} from your profile. Contact details are shared only after an interest is accepted.`) };
  }

  const existing = user.profile;
  if (existing) {
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""));
    const changed = MODERATED.some((k) => norm(existing[k as keyof typeof existing]) !== norm(data[k]));
    const status = existing.status === "APPROVED" && !changed ? "APPROVED" : existing.status === "HIDDEN" ? "HIDDEN" : "PENDING";
    await db.profile.update({ where: { id: existing.id }, data: { ...data, status, rejectionReason: null } });
    revalidatePath("/", "layout");
    return { message: await tm(status === "PENDING" ? "Saved. Your changes will be reviewed shortly." : "Profile saved.") };
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
  if (!(file instanceof File) || file.size === 0) return { error: await tm("Choose a photo to upload.") };
  if (file.size > MAX_PHOTO_BYTES) return { error: await tm("Photo must be 5 MB or smaller.") };

  if (!(await rateLimitAll([[`upload:${profile.id}`, 20, HOUR]]))) return { error: await tm(RATE_LIMITED) };

  const count = await db.photo.count({ where: { profileId: profile.id } });
  if (count >= MAX_PHOTOS) return { error: await tm(`You can upload up to ${MAX_PHOTOS} photos.`) };

  const processed = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!processed) return { error: await tm("Only JPEG, PNG or WebP images are allowed.") };

  // Hashed now so duplicate photos across accounts are flagged as soon as they reach review.
  const hash = await averageHash(processed.thumb).catch(() => null);
  const photo = await db.photo.create({ data: { profileId: profile.id, isPrimary: count === 0, hash } });
  try {
    await putPhoto(photo.id, processed);
  } catch (e) {
    console.error("[storage] photo upload failed:", e instanceof Error ? e.message : e);
    await db.photo.delete({ where: { id: photo.id } });
    return { error: await tm("We couldn't save the photo. Please try again.") };
  }
  revalidatePath("/photos");
  return { message: await tm("Uploaded. The photo will be visible to others after review.") };
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
  await deleteStoredPhoto(photo.id);
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

export async function uploadHoroscope(_: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  const file = fd.get("horoscope");
  if (!(file instanceof File) || file.size === 0) return { error: await tm("Choose your horoscope file to upload.") };
  if (file.size > MAX_HOROSCOPE_BYTES) return { error: await tm("The file must be 5 MB or smaller.") };
  if (!(await rateLimitAll([[`horoscope:${profile.id}`, 10, HOUR]]))) return { error: await tm(RATE_LIMITED) };

  const processed = await processHoroscope(Buffer.from(await file.arrayBuffer()));
  if (!processed) return { error: await tm("Upload a PDF, JPEG, PNG or WebP file.") };
  const data = new Uint8Array(processed.data);
  await db.horoscope.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, data, mime: processed.mime },
    update: { data, mime: processed.mime, uploadedAt: new Date() },
  });
  revalidatePath("/profile/edit");
  revalidatePath(`/profiles/${profile.code}`);
  return { message: await tm("Horoscope uploaded.") };
}

export async function deleteHoroscope(): Promise<FormState> {
  const { profile } = await requireProfile();
  await db.horoscope.deleteMany({ where: { profileId: profile.id } });
  revalidatePath("/profile/edit");
  revalidatePath(`/profiles/${profile.code}`);
  return { message: await tm("Horoscope removed.") };
}
