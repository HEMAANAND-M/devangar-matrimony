import { readFile } from "node:fs/promises";
import path from "node:path";
import { isConnected, visiblePhotos } from "@/lib/access";
import { db } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/photos";
import { getCurrentUser } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const photo = await db.photo.findUnique({
    where: { id },
    include: { profile: { include: { photos: true } } },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  const viewer = { profileId: user.profile?.id, isAdmin: user.role === "ADMIN" };
  const connected = viewer.profileId ? await isConnected(viewer.profileId, photo.profileId) : false;
  if (!visiblePhotos(photo.profile, viewer, connected).some((p) => p.id === photo.id)) {
    return new Response("Not found", { status: 404 });
  }

  const data = await readFile(path.join(UPLOAD_DIR, path.basename(photo.fileName)));
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=3600" },
  });
}
