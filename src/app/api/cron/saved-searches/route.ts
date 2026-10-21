import { db } from "@/lib/db";
import { link, notifyProfile } from "@/lib/notify";
import { newMatchesWhere, normalizeSearch, searchQueryString } from "@/lib/queries";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 60;

// At most one alert per saved search per day, even if the job runs more often or is retried.
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

/** Daily job: tells members when new profiles match a saved search with alerts on. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const searches = await db.savedSearch.findMany({
    where: {
      alert: true,
      profile: { status: "APPROVED" },
      OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: new Date(now.getTime() - MIN_GAP_MS) } }],
    },
    include: { profile: { select: { id: true, name: true, gender: true, gothram: true, prefExcludeOwnGothram: true } } },
    take: 2000,
  });

  let alerted = 0;
  for (const s of searches) {
    const params = normalizeSearch(s.params as Record<string, unknown>);
    const count = await db.profile.count({ where: newMatchesWhere(s.profile, params, s.lastNotifiedAt ?? s.createdAt) });
    if (count) {
      const qs = searchQueryString({ ...params, sort: "newest" });
      await notifyProfile(s.profile.id, "saved_search_matches", {
        name: s.profile.name.split(" ")[0],
        count: String(count),
        search: s.name,
        link: link(`/search?${qs}`),
      });
      alerted++;
    }
    await db.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: now } });
  }
  return Response.json({ searchesChecked: searches.length, alertsSent: alerted });
}
