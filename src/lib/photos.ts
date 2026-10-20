import "server-only";
import sharp from "sharp";
import { WATERMARK_PNG_BASE64 } from "./watermark-data";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 6;

// Refuse decompression bombs: 40 MP is far beyond any phone camera photo.
const MAX_INPUT_PIXELS = 40_000_000;
const WATERMARK = Buffer.from(WATERMARK_PNG_BASE64, "base64");

/** Burns the site watermark into the bottom-right corner, sized relative to the image. */
async function watermark(image: Buffer, widthRatio: number, quality: number): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  const markWidth = Math.max(120, Math.round(width * widthRatio));
  const mark = await sharp(WATERMARK).resize({ width: markWidth }).toBuffer();
  const markHeight = Math.round((markWidth * 120) / 720);
  const margin = Math.round(width * 0.03);
  return sharp(image)
    .composite([{ input: mark, left: Math.max(0, width - markWidth - margin), top: Math.max(0, height - markHeight - margin) }])
    .webp({ quality })
    .toBuffer();
}

/**
 * Validates and re-encodes an upload. Re-encoding strips all metadata (EXIF GPS location,
 * camera serials) and neutralises crafted files; the original bytes are never stored.
 * Both renditions carry the site watermark to discourage reuse elsewhere.
 */
export async function processPhoto(input: Buffer): Promise<{ full: Buffer; thumb: Buffer } | null> {
  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await base.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "heif"].includes(meta.format)) return null;
    // rotate() applies the EXIF orientation before the metadata is dropped.
    const oriented = base.rotate();
    const [full, thumb] = await Promise.all([
      oriented.clone().resize({ width: 1200, height: 1500, fit: "inside", withoutEnlargement: true }).png().toBuffer(),
      oriented.clone().resize({ width: 480, height: 600, fit: "cover", position: "attention" }).png().toBuffer(),
    ]);
    return {
      full: await watermark(full, 0.38, 82),
      thumb: await watermark(thumb, 0.42, 74),
    };
  } catch {
    return null;
  }
}

/** Re-encodes an ID document image (stripping metadata). PDFs are accepted as-is after a signature check. */
export async function processIdDocument(input: Buffer): Promise<{ bytes: Buffer; mime: string } | null> {
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") return { bytes: input, mime: "application/pdf" };
  try {
    const img = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await img.metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) return null;
    const bytes = await img.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return { bytes, mime: "image/webp" };
  } catch {
    return null;
  }
}
