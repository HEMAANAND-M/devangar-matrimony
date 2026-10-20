import "server-only";
import sharp from "sharp";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 6;

// Refuse decompression bombs: 40 MP is far beyond any phone camera photo.
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Validates and re-encodes an upload. Re-encoding strips all metadata (EXIF GPS location,
 * camera serials) and neutralises crafted files; the original bytes are never stored.
 */
export async function processPhoto(input: Buffer): Promise<{ full: Buffer; thumb: Buffer } | null> {
  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await base.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "heif"].includes(meta.format)) return null;
    // rotate() applies the EXIF orientation before the metadata is dropped.
    const oriented = base.rotate();
    const [full, thumb] = await Promise.all([
      oriented.clone().resize({ width: 1200, height: 1500, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      oriented.clone().resize({ width: 480, height: 600, fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer(),
    ]);
    return { full, thumb };
  } catch {
    return null;
  }
}
