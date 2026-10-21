import { liveAdWhere } from "@/lib/ads";
import { db } from "@/lib/db";
import { MINUTE, clientIp, rateLimit } from "@/lib/rate-limit";

/** Counts a click (once a minute per visitor and ad) and sends the visitor to the advertiser. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await db.advertisement.findFirst({ where: { id, ...liveAdWhere() }, select: { href: true } });
  if (!ad?.href || !/^https:\/\//.test(ad.href)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (await rateLimit(`ad-click:${await clientIp()}:${id}`, 1, MINUTE)) {
    await db.advertisement.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => {});
  }
  return new Response(null, { status: 302, headers: { Location: ad.href, "Cache-Control": "no-store", "Referrer-Policy": "origin" } });
}
