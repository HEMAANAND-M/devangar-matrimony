import "server-only";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;

/** Re-encodes a success-story photo to WebP, dropping all metadata (including GPS). */
export async function processStoryPhoto(file: File): Promise<{ data: Buffer } | { error: string }> {
  if (file.size > MAX_BYTES) return { error: "Photos must be 5 MB or smaller." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { error: "Use a JPEG, PNG or WebP photo." };
  try {
    const data = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { data };
  } catch {
    return { error: "That file could not be read as a photo." };
  }
}
