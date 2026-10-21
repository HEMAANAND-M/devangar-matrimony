import { isBlocked, isConnected, visiblePhotos } from "@/lib/access";
import { db } from "@/lib/db";
import { checkPhotoSignature } from "@/lib/photo-url";
import { getCurrentUser, isStaff } from "@/lib/session";
import { getPhoto } from "@/lib/storage";

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const thumb = search.get("size") === "thumb";
  const size = thumb ? "thumb" : "full";
  // Photo IDs are never reused and renditions never change, so the ID doubles as the ETag.
  const etag = `"${id}-${thumb ? "t" : "f"}"`;
  const base = { "Content-Type": "image/webp", ETag: etag, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" };

  // A signed URL was issued by a page after the viewer passed the access checks, so it is served
  // without a session and may be cached by browsers and the CDN until it expires.
  const signature = checkPhotoSignature(id, size, search.get("exp"), search.get("sig"));
  if (signature.state === "invalid") return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  if (signature.state === "valid") {
    const ttl = Math.min(signature.secondsLeft, 6 * 60 * 60);
    const headers = { ...base, "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, immutable` };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    const bytes = await getPhoto(id, size);
    if (!bytes) return NOT_FOUND();
    return new Response(new Uint8Array(bytes), { headers });
  }

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const photo = await db.photo.findUnique({
    where: { id },
    include: { profile: { select: { id: true, photoVisibility: true, gender: true, status: true, photos: true } } },
  });
  if (!photo) return NOT_FOUND();

  const isAdmin = isStaff(user);
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

  const headers = {
    ...base,
    // Revalidate on every view (a cheap 304 via the ETag) so access is re-checked each time:
    // another member using the same browser never sees photos cached for someone else.
    "Cache-Control": "private, no-cache",
    Vary: "Cookie",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const bytes = await getPhoto(id, size);
  if (!bytes) return NOT_FOUND();
  return new Response(new Uint8Array(bytes), { headers });
}
