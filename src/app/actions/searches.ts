"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { normalizeSearch, omitParams, searchQueryString } from "@/lib/queries";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireProfile } from "@/lib/session";
import { tm } from "@/lib/i18n";

const MAX_SAVED = 10;

export async function saveSearch(_: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  if (!(await rateLimitAll([[`saved-search:${profile.id}`, 30, HOUR]]))) return { error: await tm(RATE_LIMITED) };
  const name = str(fd, "name").slice(0, 60);
  if (name.length < 2) return { error: await tm("Give the search a short name.") };

  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "params") || "{}");
  } catch {
    return { error: await tm("Could not save this search.") };
  }
  // Paging and ID lookups make no sense to re-run later.
  const params = omitParams(normalizeSearch(raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}), "page", "code");

  if ((await db.savedSearch.count({ where: { profileId: profile.id } })) >= MAX_SAVED) {
    return { error: await tm(`You can keep up to ${MAX_SAVED} saved searches. Delete one first.`) };
  }
  // Alerts start from now, so the first alert only covers members who join after saving.
  await db.savedSearch.create({ data: { profileId: profile.id, name, params, alert: fd.get("alert") === "1", lastNotifiedAt: new Date() } });
  // A full reload back to the same search (with a confirmation flag) instead of revalidatePath:
  // refreshing /search in place after this action could leave the form stuck on "Please wait…".
  const qs = searchQueryString(params);
  return { redirect: `/search?${qs ? `${qs}&` : ""}saved=1` };
}

export async function deleteSearch(id: string) {
  const { profile } = await requireProfile();
  await db.savedSearch.deleteMany({ where: { id, profileId: profile.id } });
  revalidatePath("/search");
}

export async function setSearchAlert(id: string, alert: boolean) {
  const { profile } = await requireProfile();
  await db.savedSearch.updateMany({ where: { id, profileId: profile.id }, data: { alert } });
  revalidatePath("/search");
}
