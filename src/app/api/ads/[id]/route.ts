import { createHash } from "node:crypto";
import { liveAdWhere } from "@/lib/ads";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/session";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Banner image: public while the ad is live; staff can preview inactive or scheduled ads. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const live = await db.advertisement.findFirst({ where: { id, ...liveAdWhere() }, select: { image: true, imageMime: true } });
  let ad = live;
  if (!ad) {
    const user = await getCurrentUser();
    if (!user || !isStaff(user)) return notFound();
    ad = await db.advertisement.findUnique({ where: { id }, select: { image: true, imageMime: true } });
    if (!ad) return notFound();
  }
  const etag = `"${createHash("sha1").update(ad.image).digest("hex").slice(0, 16)}"`;
  const headers = {
    "Content-Type": ad.imageMime,
    // Live banners are public; previews of unpublished ones must never sit in a shared cache.
    "Cache-Control": live ? "public, max-age=3600" : "private, no-store",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(ad.image), { headers });
}
