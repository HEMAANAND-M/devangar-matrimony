import "server-only";
import type { Prisma, Profile } from "@prisma/client";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, RASIS, STARS } from "./constants";
import { dobRangeForAges } from "./format";

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

/** Photos plus the owner's last activity, for profile cards. */
export const withCard = {
  photos: { orderBy: { createdAt: "asc" } },
  user: { select: { lastActiveAt: true } },
} satisfies Prisma.ProfileInclude;

// ---- Search -------------------------------------------------------------------------------------

const SINGLE_KEYS = [
  "ageMin", "ageMax", "heightMin", "heightMax", "rasi", "dosham", "motherTongue", "maritalStatus", "subSect",
  "education", "withPhoto", "verified", "active", "gothram", "sort", "code", "page",
] as const;
const MULTI_KEYS = ["star", "city"] as const;

export type SearchParams = Partial<Record<(typeof SINGLE_KEYS)[number], string>> &
  Partial<Record<(typeof MULTI_KEYS)[number], string[]>>;

export const SEARCH_SORTS = {
  updated: "Recently updated",
  match: "Best match",
  newest: "Newest members",
  active: "Recently active",
  youngest: "Age: youngest first",
  oldest: "Age: oldest first",
} as const;
export type SearchSort = keyof typeof SEARCH_SORTS;

/** Height choices from 4ft 6in to 7ft in one-inch steps, keyed by cm. */
export const HEIGHTS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 31 }, (_, i) => {
    const inches = 54 + i;
    return [String(Math.round(inches * 2.54)), `${Math.floor(inches / 12)}ft ${inches % 12}in`];
  }),
);

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Keeps only known, non-empty params (from a query string or saved-search JSON). */
export function normalizeSearch(raw: Record<string, unknown>): SearchParams {
  const sp: SearchParams = {};
  for (const k of SINGLE_KEYS) {
    const v = Array.isArray(raw[k]) ? (raw[k] as unknown[])[0] : raw[k];
    if (typeof v === "string" && v.trim()) sp[k] = v.trim().slice(0, 80);
  }
  for (const k of MULTI_KEYS) {
    const v = raw[k];
    const list = (Array.isArray(v) ? v : [v])
      .filter((x): x is string => typeof x === "string" && !!x.trim())
      .map((x) => x.trim().slice(0, 60));
    if (list.length) sp[k] = [...new Set(list)].slice(0, 30);
  }
  return sp;
}

/** Copy of the params without the given keys. */
export function omitParams(sp: SearchParams, ...keys: (keyof SearchParams)[]): SearchParams {
  return Object.fromEntries(Object.entries(sp).filter(([k]) => !keys.includes(k as keyof SearchParams))) as SearchParams;
}

export function searchQueryString(sp: SearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const item of Array.isArray(v) ? v : [v]) if (item) q.append(k, item);
  return q.toString();
}

export function searchSort(sp: SearchParams): SearchSort {
  return sp.sort && Object.hasOwn(SEARCH_SORTS, sp.sort) ? (sp.sort as SearchSort) : "updated";
}

/**
 * Whether the viewer's own gothram is excluded. Defaults to their partner preference; the
 * `gothram` param ("exclude" / "include") overrides it for one search.
 */
export function excludesOwnGothram(viewer: Pick<Profile, "gothram" | "prefExcludeOwnGothram">, sp: SearchParams): boolean {
  if (!viewer.gothram) return false;
  if (sp.gothram === "include") return false;
  if (sp.gothram === "exclude") return true;
  return viewer.prefExcludeOwnGothram;
}

const inList = (list: string[], v?: string): v is string => v !== undefined && list.includes(v);
const has = (o: Record<string, string>, k?: string): k is string => k !== undefined && Object.hasOwn(o, k);

export function searchBounds(sp: SearchParams) {
  const ageMin = Math.min(80, Math.max(18, Number(sp.ageMin) || 18));
  const ageMax = Math.min(80, Math.max(ageMin, Number(sp.ageMax) || 60));
  const heightMin = has(HEIGHTS, sp.heightMin) ? Number(sp.heightMin) : undefined;
  const heightMax = has(HEIGHTS, sp.heightMax) ? Number(sp.heightMax) : undefined;
  return { ageMin, ageMax, heightMin, heightMax };
}

/** Prisma filter for a member's search. A profile ID lookup ignores every other filter. */
export function searchWhere(
  viewer: Pick<Profile, "id" | "gender" | "gothram" | "prefExcludeOwnGothram">,
  sp: SearchParams,
  now = new Date(),
): Prisma.ProfileWhereInput {
  const base = browsableWhere(viewer);
  const code = sp.code?.toUpperCase();
  if (code) return { ...base, code };

  const { ageMin, ageMax, heightMin, heightMax } = searchBounds(sp);
  const and: Prisma.ProfileWhereInput[] = [];
  const stars = sp.star?.filter((s) => STARS.includes(s));
  if (sp.city?.length) and.push({ OR: sp.city.map((c) => ({ city: { equals: c, mode: "insensitive" as const } })) });
  if (viewer.gothram && excludesOwnGothram(viewer, sp)) {
    and.push({ OR: [{ gothram: null }, { NOT: { gothram: { equals: viewer.gothram, mode: "insensitive" } } }] });
  }
  return {
    ...base,
    dateOfBirth: dobRangeForAges(ageMin, ageMax, now),
    ...((heightMin || heightMax) && { heightCm: { gte: heightMin, lte: heightMax } }),
    ...(stars?.length && { star: { in: stars } }),
    ...(inList(RASIS, sp.rasi) && { rasi: sp.rasi }),
    ...(has(DOSHAM_LABELS, sp.dosham) && { dosham: sp.dosham as never }),
    ...(inList(MOTHER_TONGUES, sp.motherTongue) && { motherTongue: sp.motherTongue }),
    ...(has(MARITAL_STATUS_LABELS, sp.maritalStatus) && { maritalStatus: sp.maritalStatus as never }),
    ...(sp.subSect && { subSect: { equals: sp.subSect, mode: "insensitive" } }),
    ...(sp.education && { education: { contains: sp.education, mode: "insensitive" } }),
    ...(sp.withPhoto && { photos: { some: { approved: true } } }),
    ...(sp.verified && { idVerifiedAt: { not: null } }),
    ...(sp.active && { user: { lastActiveAt: { gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } } }),
    ...(and.length && { AND: and }),
  };
}

export function searchOrderBy(sort: SearchSort): Prisma.ProfileOrderByWithRelationInput[] {
  const primary: Record<SearchSort, Prisma.ProfileOrderByWithRelationInput> = {
    updated: { updatedAt: "desc" },
    match: { updatedAt: "desc" },
    newest: { createdAt: "desc" },
    active: { user: { lastActiveAt: { sort: "desc", nulls: "last" } } },
    youngest: { dateOfBirth: "desc" },
    oldest: { dateOfBirth: "asc" },
  };
  return [primary[sort], { id: "asc" }];
}

/** Members matching a saved search who joined after `since`. */
export function newMatchesWhere(
  viewer: Pick<Profile, "id" | "gender" | "gothram" | "prefExcludeOwnGothram">,
  sp: SearchParams,
  since: Date,
): Prisma.ProfileWhereInput {
  return { ...searchWhere(viewer, omitParams(sp, "code", "page", "sort")), createdAt: { gt: since } };
}
