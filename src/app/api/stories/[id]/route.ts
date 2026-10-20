import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/session";

/** Success-story photo: public once published, staff-only before that. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await db.successStory.findUnique({ where: { id }, select: { photo: true, photoMime: true, published: true } });
  if (!story?.photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!story.published) {
    const user = await getCurrentUser();
    if (!user || !isStaff(user)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const etag = `"${createHash("sha1").update(story.photo).digest("hex").slice(0, 16)}"`;
  const headers = {
    "Content-Type": story.photoMime ?? "image/webp",
    // Published couples chose to share publicly; drafts must never sit in a shared cache.
    "Cache-Control": story.published ? "public, max-age=300, stale-while-revalidate=86400" : "private, no-store",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(story.photo), { headers });
}
