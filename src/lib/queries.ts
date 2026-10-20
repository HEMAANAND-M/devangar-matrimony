import "server-only";
import type { Prisma, Profile } from "@prisma/client";

/** Base filter for profiles a member may browse: approved, opposite gender, not themselves. */
export function browsableWhere(viewer: Profile): Prisma.ProfileWhereInput {
  return {
    status: "APPROVED",
    gender: viewer.gender === "MALE" ? "FEMALE" : "MALE",
    id: { not: viewer.id },
  };
}

export const withPhotos = { photos: { orderBy: { createdAt: "asc" } } } satisfies Prisma.ProfileInclude;
