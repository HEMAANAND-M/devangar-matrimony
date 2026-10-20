import { isBlocked, isConnected, visiblePhotos } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thumb = new URL(request.url).searchParams.get("size") === "thumb";
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const photo = await db.photo.findUnique({
    where: { id },
    include: { profile: { select: { id: true, photoVisibility: true, gender: true, status: true, photos: true } } },
  });
  if (!photo) return NOT_FOUND();

  const isAdmin = user.role === "ADMIN";
  const viewerProfileId = user.profile?.id;
  const isOwner = viewerProfileId === photo.profileId;
  if (!isAdmin && !isOwner) {
    // Same visibility rules as the profile page: approved, opposite gender, not blocked.
    if (!user.profile || photo.profile.status !== "APPROVED" || photo.profile.gender === user.profile.gender) return NOT_FOUND();
    if (await isBlocked(user.profile.id, photo.profileId)) return NOT_FOUND();
  }
  const connected = viewerProfileId && !isOwner ? await isConnected(viewerProfileId, photo.profileId) : false;
  if (!visiblePhotos(photo.profile, { profileId: viewerProfileId, isAdmin }, connected).some((p) => p.id === photo.id)) {
    return NOT_FOUND();
  }

  // Photo IDs are never reused and renditions never change, so the ID doubles as the ETag.
  const etag = `"${photo.id}-${thumb ? "t" : "f"}"`;
  const headers = {
    "Content-Type": "image/webp",
    // Private: only the signed-in viewer's browser may cache; revalidate daily so privacy changes apply.
    "Cache-Control": "private, max-age=86400",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  // Select only the rendition being served; the other may be several hundred KB.
  const bytes = thumb
    ? (await db.photoBlob.findUnique({ where: { photoId: id }, select: { thumb: true } }))?.thumb
    : (await db.photoBlob.findUnique({ where: { photoId: id }, select: { full: true } }))?.full;
  if (!bytes) return NOT_FOUND();
  return new Response(new Uint8Array(bytes), { headers });
}
