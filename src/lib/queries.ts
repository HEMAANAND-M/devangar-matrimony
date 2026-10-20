import "server-only";
import type { Prisma, Profile } from "@prisma/client";

/**
 * Base filter for profiles a member may browse: approved, opposite gender, not themselves,
 * and no block in either direction.
 */
export function browsableWhere(viewer: Pick<Profile, "id" | "gender">): Prisma.ProfileWhereInput {
  return {
    status: "APPROVED",
    gender: viewer.gender === "MALE" ? "FEMALE" : "MALE",
    id: { not: viewer.id },
    blocksMade: { none: { blockedId: viewer.id } },
    blocksReceived: { none: { blockerId: viewer.id } },
  };
}

export const withPhotos = { photos: { orderBy: { createdAt: "asc" } } } satisfies Prisma.ProfileInclude;
