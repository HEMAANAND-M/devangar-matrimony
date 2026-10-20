import "server-only";
import sharp from "sharp";
import { db } from "./db";
import { findContactInfo } from "./moderation";
import { getPhoto } from "./storage";

export const FLAG_INFO: Record<string, { label: string; detail: string }> = {
  contact_info: { label: "Contact details", detail: "Profile text contains a phone number, email, link or social handle." },
  duplicate_photo: { label: "Duplicate photo", detail: "A photo closely matches one on another member's profile." },
  shared_device: { label: "Shared device", detail: "Signed in from a device that another account also uses." },
  interest_spike: { label: "Interest spike", detail: "Sent more than 25 interests in the last 24 hours." },
  new_account_many_reports: { label: "Many reports", detail: "Has 3 or more open reports from other members." },
};

/** 64-bit average hash of an image as 16 hex characters (one per 4 pixels, row-major). */
export async function averageHash(image: Buffer): Promise<string> {
  const px = await sharp(image).removeAlpha().greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  const mean = px.reduce((s, v) => s + v, 0) / px.length;
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (px[i + j] >= mean ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingDistance(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < 16; i++) n += POPCOUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return n;
}

/** Hashes photos uploaded before hashing existed (or whose hashing failed at upload). */
export async function ensurePhotoHashes(limit = 40) {
  const missing = await db.photo.findMany({
    where: { hash: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  for (const p of missing) {
    try {
      const thumb = await getPhoto(p.id, "thumb");
      if (!thumb) continue;
      const hash = await averageHash(Buffer.from(thumb));
      await db.photo.update({ where: { id: p.id }, data: { hash } });
    } catch {
      // An unreadable blob is left unhashed; the photo route reports it separately.
    }
  }
}

const DUPLICATE_DISTANCE = 5;

export type DuplicateMatch = { photoId: string; profileCode: string; profileName: string; distance: number };

/**
 * For each given photo, the closest-matching photo on a different profile (if within the duplicate
 * threshold). Hashes are compared in memory: the hashed set is small (â‰¤ 6 photos per member).
 */
export async function findDuplicatePhotos(photoIds: string[]) {
  if (!photoIds.length) return new Map<string, DuplicateMatch>();
  const [targets, all] = await Promise.all([
    db.photo.findMany({ where: { id: { in: photoIds }, hash: { not: null } }, select: { id: true, hash: true, profileId: true } }),
    db.photo.findMany({
      where: { hash: { not: null } },
      select: { id: true, hash: true, profileId: true, profile: { select: { code: true, name: true } } },
    }),
  ]);
  const result = new Map<string, DuplicateMatch>();
  for (const t of targets) {
    let best: DuplicateMatch | null = null;
    for (const o of all) {
      if (o.profileId === t.profileId) continue;
      const d = hammingDistance(t.hash!, o.hash!);
      if (d <= DUPLICATE_DISTANCE && (!best || d < best.distance)) {
        best = { photoId: o.id, profileCode: o.profile.code, profileName: o.profile.name, distance: d };
      }
    }
    if (best) result.set(t.id, best);
  }
  return result;
}

/** Recomputes Profile.flags from current data and stores it. */
export async function refreshFlags(profileId: string): Promise<string[]> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      userId: true, about: true, prefNotes: true, siblings: true, fatherOccupation: true, motherOccupation: true,
      nativePlace: true, photos: { select: { id: true } },
    },
  });
  if (!profile) return [];
  const flags: string[] = [];

  const text = [profile.about, profile.prefNotes, profile.siblings, profile.fatherOccupation, profile.motherOccupation, profile.nativePlace].join("\n");
  if (findContactInfo(text)) flags.push("contact_info");

  const dupes = await findDuplicatePhotos(profile.photos.map((p) => p.id));
  if (dupes.size) flags.push("duplicate_photo");

  const devices = await db.loginEvent.findMany({ where: { userId: profile.userId }, select: { deviceId: true }, distinct: ["deviceId"], take: 20 });
  if (devices.length) {
    const shared = await db.loginEvent.findFirst({
      where: { deviceId: { in: devices.map((d) => d.deviceId) }, userId: { not: profile.userId } },
      select: { id: true },
    });
    if (shared) flags.push("shared_device");
  }

  const [sentToday, openReports] = await Promise.all([
    db.interest.count({ where: { fromId: profileId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    db.report.count({ where: { targetId: profileId, resolved: false } }),
  ]);
  if (sentToday > 25) flags.push("interest_spike");
  if (openReports >= 3) flags.push("new_account_many_reports");

  await db.profile.update({ where: { id: profileId }, data: { flags } });
  return flags;
}
