import Link from "next/link";
import { deleteSearch, saveSearch, setSearchAlert } from "@/app/actions/searches";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { CheckboxGroup, SelectField, TextField } from "@/components/fields";
import { connectedIds } from "@/lib/access";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, PAGE_SIZE, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { type TKey, getT, getTx } from "@/lib/i18n";
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
  const rawParams = await searchParams;
  const sp = normalizeSearch(rawParams);
  const justSaved = rawParams.saved === "1";

  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const { ageMin, ageMax, heightMin, heightMax } = searchBounds(sp);
  const sort = searchSort(sp);
  const code = sp.code?.toUpperCase();
  const byMatch = sort === "match" && !code;
  const where = searchWhere(profile, sp);
  const gothramExcluded = excludesOwnGothram(profile, sp);
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const translated = (options: string[] | Record<string, string>) =>
    Object.fromEntries((Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options)).map(([k, v]) => [k, tx(v)]));
  // Splits a translated sentence around a value that is rendered with emphasis.
  const around = (key: TKey, vars: Record<string, string | number>, slot: string) => t(key, { ...vars, [slot]: "\u0000" }).split("\u0000");

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
    ? [[t("search.chipId", { code }), without("code")]]
    : ([
        (sp.ageMin || sp.ageMax) && [t("search.chipAge", { min: ageMin, max: ageMax }), without("ageMin", "ageMax")],
        (heightMin || heightMax) && [
          t("search.chipHeight", { min: heightMin ? HEIGHTS[heightMin] : t("common.any"), max: heightMax ? HEIGHTS[heightMax] : t("common.any") }),
          without("heightMin", "heightMax"),
        ],
        ...(sp.star ?? []).map((s) => [t("search.chipStar", { value: tx(s) }), withoutItem("star", s)]),
        ...(sp.city ?? []).map((c) => [t("search.chipCity", { value: c }), withoutItem("city", c)]),
        sp.rasi && RASIS.includes(sp.rasi) && [t("search.chipRasi", { value: tx(sp.rasi) }), without("rasi")],
        sp.dosham && DOSHAM_LABELS[sp.dosham] && [t("search.chipDosham", { value: tx(DOSHAM_LABELS[sp.dosham]) }), without("dosham")],
        sp.motherTongue && MOTHER_TONGUES.includes(sp.motherTongue) && [tx(sp.motherTongue), without("motherTongue")],
        sp.maritalStatus && MARITAL_STATUS_LABELS[sp.maritalStatus] && [tx(MARITAL_STATUS_LABELS[sp.maritalStatus]), without("maritalStatus")],
        sp.subSect && [t("search.chipSubSect", { value: sp.subSect }), without("subSect")],
        sp.education && [t("search.chipEducation", { value: sp.education }), without("education")],
        sp.withPhoto && [t("search.chipWithPhoto"), without("withPhoto")],
        sp.verified && [t("search.chipVerified"), without("verified")],
        sp.active && [t("search.chipActive"), without("active")],
        gothramExcluded && [t("search.chipNotGothram", { gothram: profile.gothram ?? "" }), href({ ...savable, gothram: "include" })],
      ].filter(Boolean) as [string, string][]);
  const moreOpen = Boolean(sp.rasi || sp.dosham || sp.education || sp.subSect || sp.star?.length || sp.city?.length);

  return (
    <>
      <PageHeader eyebrow={t("search.eyebrow")} title={t("search.title")} subtitle={t("search.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="min-w-0 space-y-4">
          <Card title={t("search.byId")}>
            <form className="flex gap-2">
              <input
                name="code"
                defaultValue={code}
                placeholder="DM12345"
                aria-label={t("search.profileId")}
                className="block w-full min-w-0 rounded-lg border border-hairline bg-white px-3 py-2 text-sm uppercase focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
              />
              <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("search.go")}</button>
            </form>
          </Card>

          <Card title={t("search.filters")} className="h-fit">
            <form className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <TextField label={t("search.ageFrom")} name="ageMin" type="number" min={18} max={80} defaultValue={ageMin} />
                <TextField label={t("search.to")} name="ageMax" type="number" min={18} max={80} defaultValue={ageMax} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label={t("search.heightFrom")} name="heightMin" options={HEIGHTS} defaultValue={sp.heightMin} placeholder={t("search.anyOption")} />
                <SelectField label={t("search.to")} name="heightMax" options={HEIGHTS} defaultValue={sp.heightMax} placeholder={t("search.anyOption")} />
              </div>
              <SelectField label={t("search.motherTongue")} name="motherTongue" options={translated(MOTHER_TONGUES)} defaultValue={sp.motherTongue} placeholder={t("search.anyOption")} />
              <SelectField label={t("search.maritalStatus")} name="maritalStatus" options={translated(MARITAL_STATUS_LABELS)} defaultValue={sp.maritalStatus} placeholder={t("search.anyOption")} />
              {profile.gothram && (
                <SelectField
                  label={t("search.gothram")}
                  name="gothram"
                  options={{ exclude: t("search.excludeGothram", { gothram: profile.gothram }), include: t("search.includeGothram") }}
                  defaultValue={gothramExcluded ? "exclude" : "include"}
                  placeholder={t("search.asPrefs")}
                />
              )}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="withPhoto" value="1" defaultChecked={Boolean(sp.withPhoto)} className="h-4 w-4 accent-maroon" />
                  {t("search.withPhoto")}
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="verified" value="1" defaultChecked={Boolean(sp.verified)} className="h-4 w-4 accent-maroon" />
                  {t("search.idVerified")}
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="active" value="1" defaultChecked={Boolean(sp.active)} className="h-4 w-4 accent-maroon" />
                  {t("search.active")}
                </label>
              </div>

              <details open={moreOpen} className="rounded-xl border border-hairline px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-maroon">{t("search.more")}</summary>
                <div className="mt-3 space-y-4">
                  <SelectField label={t("search.subSect")} name="subSect" options={lists.subSects} defaultValue={sp.subSect} placeholder={t("search.anyOption")} />
                  <SelectField label={t("search.rasi")} name="rasi" options={translated(RASIS)} defaultValue={sp.rasi} placeholder={t("search.anyOption")} />
                  <SelectField label={t("search.dosham")} name="dosham" options={translated(DOSHAM_LABELS)} defaultValue={sp.dosham} placeholder={t("search.anyOption")} />
                  <TextField label={t("search.educationContains")} name="education" defaultValue={sp.education} />
                  <CheckboxGroup label={t("search.stars")} name="star" options={translated(STARS)} defaultValues={sp.star} columns={2} />
                  <CheckboxGroup label={t("search.cities")} name="city" options={lists.cities} defaultValues={sp.city} columns={2} />
                </div>
              </details>

              {sp.sort && <input type="hidden" name="sort" value={sort} />}
              <div className="flex gap-2 pt-2">
                <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("search.search")}</button>
                <Link href="/search" className="px-2 py-2 text-sm text-stone-600 underline">{t("search.reset")}</Link>
              </div>
            </form>
          </Card>

          <Card title={t("search.saved")}>
            {saved.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={href(normalizeSearch(s.params as Record<string, unknown>))} className="min-w-0 truncate font-medium text-maroon hover:underline">
                      {s.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <form action={setSearchAlert.bind(null, s.id, !s.alert)}>
                        <button className={s.alert ? "text-emerald-700" : "text-stone-500"} title={t(s.alert ? "search.alertsOnTitle" : "search.alertsOffTitle")}>
                          {t(s.alert ? "search.alertsOn" : "search.alertsOff")}
                        </button>
                      </form>
                      <form action={deleteSearch.bind(null, s.id)}>
                        <button className="text-stone-500 hover:text-red-700" aria-label={t("search.deleteSaved", { name: s.name })}>{t("search.delete")}</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-600">{t("search.savedEmpty")}</p>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              {(() => {
                const [before, after] = around(total === 1 ? "search.foundOne" : "search.found", { count: total }, "count");
                return total === 1 && after === undefined ? before : <>{before}<span className="font-semibold text-stone-900">{total}</span>{after}</>;
              })()}
            </p>
            {!code && (
              <form className="flex flex-wrap items-center gap-2 text-sm">
                {Object.entries(savable).flatMap(([k, v]) =>
                  k === "sort" ? [] : (Array.isArray(v) ? v : [v]).map((item, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={item} />),
                )}
                <label htmlFor="sort" className="text-stone-600">{t("search.sortBy")}</label>
                <select id="sort" name="sort" defaultValue={sort} className="rounded-full border border-hairline bg-white px-3 py-1.5">
                  {Object.keys(SEARCH_SORTS).map((k) => <option key={k} value={k}>{t(`search.sort.${k}` as TKey)}</option>)}
                </select>
                <button className="rounded-full border border-gold/60 px-4 py-1.5 text-maroon hover:bg-gold-light/30">{t("search.apply")}</button>
              </form>
            )}
          </div>

          {chips.length > 0 && (
            <ul className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              {chips.map(([label, removeHref]) => (
                <li key={label}>
                  <Link href={removeHref} className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold-light/30 px-3 py-1 text-maroon hover:bg-gold-light/60" aria-label={t("search.removeFilter", { label })}>
                    {label} <span aria-hidden>×</span>
                  </Link>
                </li>
              ))}
              <li><Link href="/search" className="text-stone-600 underline">{t("search.clearAll")}</Link></li>
            </ul>
          )}

          {justSaved && (
            <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-800">{tx("Search saved.")}</p>
          )}
          {!code && (
            <details className="mb-5 rounded-xl border border-hairline bg-white px-4 py-3 shadow-soft">
              <summary className="cursor-pointer text-sm font-medium text-maroon">{t("search.saveThis")}</summary>
              <ActionForm action={saveSearch} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="params" value={JSON.stringify(savable)} />
                <div className="min-w-48 flex-1">
                  <TextField label={t("search.name")} name="name" required maxLength={60} placeholder={t("search.namePlaceholder")} />
                </div>
                <label className="flex items-center gap-2 pb-3 text-sm text-stone-700">
                  <input type="checkbox" name="alert" value="1" defaultChecked className="h-4 w-4 accent-maroon" />
                  {t("search.alertMe")}
                </label>
                <SubmitButton variant="secondary">{t("search.save")}</SubmitButton>
              </ActionForm>
            </details>
          )}

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gold/40 bg-white px-6 py-12 text-center">
              <p className="font-display text-2xl text-maroon">{t(code ? "search.noId" : page > pages ? "search.pastEnd" : "search.noResults")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
                {code ? (
                  (() => {
                    const [before, after] = around("search.noIdBody", {}, "code");
                    return <>{before}<strong>{code}</strong>{after}</>;
                  })()
                ) : page > pages ? (
                  <>{t("search.pastEndBody")} <Link href={href(savable)} className={link}>{t("search.firstPage")}</Link></>
                ) : (
                  <>{t("search.noResultsBody")}</>
                )}
              </p>
              {!code && chips.length > 0 && (
                <Link href="/search" className="mt-5 inline-block rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">{t("search.clearFilters")}</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {results.map((r) => <ProfileCard key={r.id} profile={r} photo={cardPhoto(r, connected)} viewer={profile} />)}
            </div>
          )}

          {pages > 1 && page <= pages && (
            <nav className="mt-6 flex items-center justify-center gap-4 text-sm">
              {page > 1 && <Link href={href({ ...sp, page: String(page - 1) })} className={link}>{t("search.previous")}</Link>}
              <span>{t("search.pageOf", { page, pages })}</span>
              {page < pages && <Link href={href({ ...sp, page: String(page + 1) })} className={link}>{t("search.next")}</Link>}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
