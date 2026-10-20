import "server-only";
import sharp from "sharp";
import { isBlocked, isConnected } from "./access";
import { db } from "./db";

export const MAX_HOROSCOPE_BYTES = 5 * 1024 * 1024;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

/**
 * Validates an uploaded horoscope by its content, not its name or declared type. Images are
 * re-encoded to WebP (which also drops EXIF/GPS metadata); PDFs are stored unchanged.
 */
export async function processHoroscope(input: Buffer): Promise<{ data: Buffer; mime: string } | null> {
  if (startsWith(input, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { data: input, mime: "application/pdf" }; // %PDF-
  const isImage =
    startsWith(input, [0xff, 0xd8, 0xff]) ||
    startsWith(input, [0x89, 0x50, 0x4e, 0x47]) ||
    (startsWith(input, [0x52, 0x49, 0x46, 0x46]) && startsWith(input, [0x57, 0x45, 0x42, 0x50], 8));
  if (!isImage) return null;
  try {
    const data = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { data, mime: "image/webp" };
  } catch {
    return null;
  }
}

type Viewer = { profileId?: string; gender?: string; isStaff: boolean };
type Target = { id: string; status: string; gender: string; horoscopeVisibility: string };

/** Same rules as photos: owner and staff always; others need an approved, unblocked, opposite-gender profile. */
export async function canViewHoroscope(target: Target, viewer: Viewer): Promise<boolean> {
  if (viewer.isStaff || viewer.profileId === target.id) return true;
  if (!viewer.profileId || target.status !== "APPROVED" || target.gender === viewer.gender) return false;
  if (await isBlocked(viewer.profileId, target.id)) return false;
  if (target.horoscopeVisibility === "ACCEPTED_ONLY") return isConnected(viewer.profileId, target.id);
  return true;
}

export const horoscopeInfo = (profileId: string) =>
  db.horoscope.findUnique({ where: { profileId }, select: { mime: true, uploadedAt: true } });
