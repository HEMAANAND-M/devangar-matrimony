import "server-only";
import type { Photo, Profile } from "@prisma/client";
import { db } from "./db";

/** True when either side has accepted an interest from the other. */
export async function isConnected(a: string, b: string): Promise<boolean> {
  const hit = await db.interest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromId: a, toId: b },
        { fromId: b, toId: a },
      ],
    },
    select: { id: true },
  });
  return !!hit;
}

/** IDs of every profile the given profile is connected with. */
export async function connectedIds(profileId: string): Promise<Set<string>> {
  const rows = await db.interest.findMany({
    where: { status: "ACCEPTED", OR: [{ fromId: profileId }, { toId: profileId }] },
    select: { fromId: true, toId: true },
  });
  return new Set(rows.map((r) => (r.fromId === profileId ? r.toId : r.fromId)));
}

/** Photos the viewer is allowed to see on the target profile. */
export function visiblePhotos(
  target: Pick<Profile, "id" | "photoVisibility"> & { photos: Photo[] },
  viewer: { profileId?: string; isAdmin: boolean },
  connected: boolean,
): Photo[] {
  if (viewer.isAdmin || viewer.profileId === target.id) return target.photos;
  if (target.photoVisibility === "ACCEPTED_ONLY" && !connected) return [];
  return target.photos.filter((p) => p.approved);
}
