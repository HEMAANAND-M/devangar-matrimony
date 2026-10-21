import "server-only";
import type { AdCategory, Prisma } from "@prisma/client";
import sharp from "sharp";
import { db } from "./db";
import { HOUR, rateLimit } from "./rate-limit";

export const AD_CATEGORY_LABELS: Record<AdCategory, string> = {
  WEDDING_PLANNER: "Wedding planner",
  PHOTOGRAPHER: "Photographer",
  VENUE: "Venue",
  JEWELLERY: "Jewellery",
  BRIDAL_WEAR: "Bridal wear",
  CATERING: "Catering",
  DECORATION: "Decoration",
  OTHER: "Other",
};
export const AD_CATEGORIES = Object.keys(AD_CATEGORY_LABELS) as AdCategory[];

/** Banners are shown at 8:3; uploads are cropped to this size. */
export const AD_WIDTH = 1600;
export const AD_HEIGHT = 600;
const MAX_BYTES = 5 * 1024 * 1024;

/** Ads that may be shown publicly right now. */
export function liveAdWhere(now = new Date()): Prisma.AdvertisementWhereInput {
  return {
    active: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

export function getLiveAds() {
  return db.advertisement.findMany({
    where: liveAdWhere(),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, advertiser: true, category: true, tagline: true, href: true, updatedAt: true },
    take: 12,
  });
}

/**
 * Counts one impression per carousel view, at most once every 30 minutes per visitor IP, so
 * refreshes and bots do not inflate the numbers advertisers see. Pass the IP in: request headers
 * cannot be read inside after() in a page. Never throws.
 */
export async function recordImpressions(ids: string[], ip: string) {
  if (!ids.length) return;
  try {
    if (!(await rateLimit(`ad-impression:${ip}`, 1, HOUR / 2))) return;
    await db.advertisement.updateMany({ where: { id: { in: ids } }, data: { impressions: { increment: 1 } } });
  } catch (e) {
    console.error("[ads] impression count failed:", e instanceof Error ? e.message : e);
  }
}

/** Re-encodes an uploaded banner to WebP at 1600×600 (cover crop), dropping all metadata. */
export async function processAdImage(file: File): Promise<{ data: Buffer } | { error: string }> {
  if (file.size > MAX_BYTES) return { error: "Banner images must be 5 MB or smaller." };
  const input = Buffer.from(await file.arrayBuffer());
  try {
    // Checked by content, not by the name or type the browser reports.
    const { format } = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) return { error: "Use a JPEG, PNG or WebP image." };
    const data = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: AD_WIDTH, height: AD_HEIGHT, fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    return { data };
  } catch {
    return { error: "That file could not be read as an image." };
  }
}

export const adImageUrl = (ad: { id: string; updatedAt: Date }) => `/api/ads/${ad.id}?v=${ad.updatedAt.getTime()}`;
