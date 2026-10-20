import Link from "next/link";
import { deleteSearch, saveSearch, setSearchAlert } from "@/app/actions/searches";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { CheckboxGroup, SelectField, TextField } from "@/components/fields";
import { connectedIds } from "@/lib/access";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, PAGE_SIZE, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { getLists } from "@/lib/lists";
import { matchScore } from "@/lib/match";
import {
  HEIGHTS, SEARCH_SORTS, type SearchParams, excludesOwnGothram, normalizeSearch, omitParams, searchBounds, searchOrderBy,
  searchQueryString, searchSort, searchWhere, withCard,
} from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Search" };

const MAX_PAGE = 500;
// "Best match" is scored in memory, so it ranks the most recently updated profiles that pass the filters.
const MATCH_POOL = 300;

const link = "text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireProfile();
  const sp = normalizeSearch(await searchParams);

  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const { ageMin, ageMax, heightMin, heightMax } = searchBounds(sp);
  const sort = searchSort(sp);
  const code = sp.code?.toUpperCase();
  const byMatch = sort === "match" && !code;
  const where = searchWhere(profile, sp);
  const gothramExcluded = excludesOwnGothram(profile, sp);

  const [total, rows, connected, lists, saved] = await Promise.all([
    db.profile.count({ where }),
    db.profile.findMany({
      where,
      include: withCard,
      orderBy: searchOrderBy(sort),
      skip: byMatch ? 0 : (page - 1) * PAGE_SIZE,
      take: byMatch ? MATCH_POOL : PAGE_SIZE,
    }),
    connectedIds(profile.id),
    getLists(),
    db.savedSearch.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const results = byMatch
    ? rows
        .map((r) => ({ r, s: matchScore(profile, r).score }))
        .sort((a, b) => b.s - a.s)
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .map((x) => x.r)
    : rows;
  const pages = Math.max(1, Math.ceil((byMatch ? Math.min(total, MATCH_POOL) : total) / PAGE_SIZE));

  const href = (p: SearchParams) => {
    const qs = searchQueryString(p);
    return qs ? `/search?${qs}` : "/search";
  };
  const savable = omitParams(sp, "page");
  const without = (...keys: (keyof SearchParams)[]) =>
    href(Object.fromEntries(Object.entries(savable).filter(([k]) => !keys.includes(k as keyof SearchParams))) as SearchParams);
  const withoutItem = (key: "star" | "city", item: string) => href({ ...savable, [key]: sp[key]?.filter((x) => x !== item) });

  const chips: [string, string][] = code
    ? [[`Profile ID: ${code}`, without("code")]]
    : ([
        (sp.ageMin || sp.ageMax) && [`Age ${ageMin}–${ageMax}`, without("ageMin", "ageMax")],
        (heightMin || heightMax) && [
          `Height ${heightMin ? HEIGHTS[heightMin] : "any"} – ${heightMax ? HEIGHTS[heightMax] : "any"}`,
          without("heightMin", "heightMax"),
        ],
        ...(sp.star ?? []).map((s) => [`Star: ${s}`, withoutItem("star", s)]),
        ...(sp.city ?? []).map((c) => [`City: ${c}`, withoutItem("city", c)]),
        sp.rasi && RASIS.includes(sp.rasi) && [`Rasi: ${sp.rasi}`, without("rasi")],
        sp.dosham && DOSHAM_LABELS[sp.dosham] && [`Dosham: ${DOSHAM_LABELS[sp.dosham]}`, without("dosham")],
        sp.motherTongue && MOTHER_TONGUES.includes(sp.motherTongue) && [sp.motherTongue, without("motherTongue")],
        sp.maritalStatus && MARITAL_STATUS_LABELS[sp.maritalStatus] && [MARITAL_STATUS_LABELS[sp.maritalStatus], without("maritalStatus")],
        sp.subSect && [`Sub-sect: ${sp.subSect}`, without("subSect")],
        sp.education && [`Education: ${sp.education}`, without("education")],
        sp.withPhoto && ["With photo", without("withPhoto")],
        sp.verified && ["ID verified", without("verified")],
        sp.active && ["Active in last 30 days", without("active")],
        gothramExcluded && [`Not ${profile.gothram} gothram`, href({ ...savable, gothram: "include" })],
      ].filter(Boolean) as [string, string][]);
  const moreOpen = Boolean(sp.rasi || sp.dosham || sp.education || sp.subSect || sp.star?.length || sp.city?.length);

  return (
    <>
      <PageHeader eyebrow="Discover" title="Search profiles" subtitle="Every profile shown has been reviewed by our team." />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="min-w-0 space-y-4">
          <Card title="Search by Profile ID">
            <form className="flex gap-2">
              <input
                name="code"
                defaultValue={code}
                placeholder="DM12345"
                aria-label="Profile ID"
                className="block w-full min-w-0 rounded-lg border border-hairline bg-white px-3 py-2 text-sm uppercase focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
              />
              <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">Go</button>
            </form>
          </Card>

          <Card title="Filters" className="h-fit">
            <form className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Age from" name="ageMin" type="number" min={18} max={80} defaultValue={ageMin} />
                <TextField label="to" name="ageMax" type="number" min={18} max={80} defaultValue={ageMax} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label="Height from" name="heightMin" options={HEIGHTS} defaultValue={sp.heightMin} placeholder="Any" />
                <SelectField label="to" name="heightMax" options={HEIGHTS} defaultValue={sp.heightMax} placeholder="Any" />
              </div>
              <SelectField label="Mother tongue" name="motherTongue" options={MOTHER_TONGUES} defaultValue={sp.motherTongue} placeholder="Any" />
              <SelectField label="Marital status" name="maritalStatus" options={MARITAL_STATUS_LABELS} defaultValue={sp.maritalStatus} placeholder="Any" />
              {profile.gothram && (
                <SelectField
                  label="Gothram"
                  name="gothram"
                  options={{ exclude: `Exclude my gothram (${profile.gothram})`, include: "Include all gothrams" }}
                  defaultValue={gothramExcluded ? "exclude" : "include"}
                  placeholder="As in my preferences"
                />
              )}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="withPhoto" value="1" defaultChecked={Boolean(sp.withPhoto)} className="h-4 w-4 accent-maroon" />
                  Only profiles with a photo
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="verified" value="1" defaultChecked={Boolean(sp.verified)} className="h-4 w-4 accent-maroon" />
                  Only ID-verified profiles
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="active" value="1" defaultChecked={Boolean(sp.active)} className="h-4 w-4 accent-maroon" />
                  Active in the last 30 days
                </label>
              </div>

              <details open={moreOpen} className="rounded-xl border border-hairline px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-maroon">More filters</summary>
                <div className="mt-3 space-y-4">
                  <SelectField label="Sub-sect" name="subSect" options={lists.subSects} defaultValue={sp.subSect} placeholder="Any" />
                  <SelectField label="Rasi" name="rasi" options={RASIS} defaultValue={sp.rasi} placeholder="Any" />
                  <SelectField label="Dosham" name="dosham" options={DOSHAM_LABELS} defaultValue={sp.dosham} placeholder="Any" />
                  <TextField label="Education contains" name="education" defaultValue={sp.education} />
                  <CheckboxGroup label="Stars" name="star" options={STARS} defaultValues={sp.star} columns={2} />
                  <CheckboxGroup label="Cities" name="city" options={lists.cities} defaultValues={sp.city} columns={2} />
                </div>
              </details>

              {sp.sort && <input type="hidden" name="sort" value={sort} />}
              <div className="flex gap-2 pt-2">
                <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">Search</button>
                <Link href="/search" className="px-2 py-2 text-sm text-stone-600 underline">Reset</Link>
              </div>
            </form>
          </Card>

          <Card title="Saved searches">
            {saved.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={href(normalizeSearch(s.params as Record<string, unknown>))} className="min-w-0 truncate font-medium text-maroon hover:underline">
                      {s.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <form action={setSearchAlert.bind(null, s.id, !s.alert)}>
                        <button className={s.alert ? "text-emerald-700" : "text-stone-500"} title={s.alert ? "Alerts on — select to turn off" : "Alerts off — select to turn on"}>
                          {s.alert ? "Alerts on" : "Alerts off"}
                        </button>
                      </form>
                      <form action={deleteSearch.bind(null, s.id)}>
                        <button className="text-stone-500 hover:text-red-700" aria-label={`Delete saved search ${s.name}`}>Delete</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-600">Save a search to run it again in one tap and get alerts when new members match.</p>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              <span className="font-semibold text-stone-900">{total}</span> profile{total === 1 ? "" : "s"} found
            </p>
            {!code && (
              <form className="flex flex-wrap items-center gap-2 text-sm">
                {Object.entries(savable).flatMap(([k, v]) =>
                  k === "sort" ? [] : (Array.isArray(v) ? v : [v]).map((item, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={item} />),
                )}
                <label htmlFor="sort" className="text-stone-600">Sort by</label>
                <select id="sort" name="sort" defaultValue={sort} className="rounded-full border border-hairline bg-white px-3 py-1.5">
                  {Object.entries(SEARCH_SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button className="rounded-full border border-gold/60 px-4 py-1.5 text-maroon hover:bg-gold-light/30">Apply</button>
              </form>
            )}
          </div>

          {chips.length > 0 && (
            <ul className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              {chips.map(([label, removeHref]) => (
                <li key={label}>
                  <Link href={removeHref} className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold-light/30 px-3 py-1 text-maroon hover:bg-gold-light/60" aria-label={`Remove filter ${label}`}>
                    {label} <span aria-hidden>×</span>
                  </Link>
                </li>
              ))}
              <li><Link href="/search" className="text-stone-600 underline">Clear all</Link></li>
            </ul>
          )}

          {!code && (
            <details className="mb-5 rounded-xl border border-hairline bg-white px-4 py-3 shadow-soft">
              <summary className="cursor-pointer text-sm font-medium text-maroon">☆ Save this search</summary>
              <ActionForm action={saveSearch} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="params" value={JSON.stringify(savable)} />
                <div className="min-w-48 flex-1">
                  <TextField label="Name" name="name" required maxLength={60} placeholder="e.g. Coimbatore, 25–30" />
                </div>
                <label className="flex items-center gap-2 pb-3 text-sm text-stone-700">
                  <input type="checkbox" name="alert" value="1" defaultChecked className="h-4 w-4 accent-maroon" />
                  Alert me about new matches
                </label>
                <SubmitButton variant="secondary">Save</SubmitButton>
              </ActionForm>
            </details>
          )}

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gold/40 bg-white px-6 py-12 text-center">
              <p className="font-display text-2xl text-maroon">{code ? "No member with that ID" : page > pages ? "Past the last page" : "No profiles match yet"}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
                {code ? (
                  <>No member found with ID <strong>{code}</strong>. Check the ID and try again.</>
                ) : page > pages ? (
                  <>This page is past the end of the results. <Link href={href(savable)} className={link}>Go to page 1</Link></>
                ) : (
                  <>Try widening the age or height range or removing a filter. Save the search to be told when someone new matches.</>
                )}
              </p>
              {!code && chips.length > 0 && (
                <Link href="/search" className="mt-5 inline-block rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">Clear all filters</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {results.map((r) => <ProfileCard key={r.id} profile={r} photo={cardPhoto(r, connected)} viewer={profile} />)}
            </div>
          )}

          {pages > 1 && page <= pages && (
            <nav className="mt-6 flex items-center justify-center gap-4 text-sm">
              {page > 1 && <Link href={href({ ...sp, page: String(page - 1) })} className={link}>← Previous</Link>}
              <span>Page {page} of {pages}</span>
              {page < pages && <Link href={href({ ...sp, page: String(page + 1) })} className={link}>Next →</Link>}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
