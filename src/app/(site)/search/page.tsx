import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { SelectField, TextField } from "@/components/fields";
import { connectedIds } from "@/lib/access";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, PAGE_SIZE, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { dobRangeForAges } from "@/lib/format";
import { browsableWhere, withPhotos } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Search" };

const KEYS = [
  "ageMin", "ageMax", "heightMin", "heightMax", "star", "rasi", "dosham", "motherTongue", "maritalStatus",
  "city", "education", "withPhoto", "excludeGothram", "sort", "code", "page",
] as const;
type Params = Partial<Record<(typeof KEYS)[number], string>>;

const SORTS = {
  updated: { label: "Recently updated", orderBy: { updatedAt: "desc" } },
  newest: { label: "Newest members", orderBy: { createdAt: "desc" } },
  youngest: { label: "Age: youngest first", orderBy: { dateOfBirth: "desc" } },
  oldest: { label: "Age: oldest first", orderBy: { dateOfBirth: "asc" } },
} satisfies Record<string, { label: string; orderBy: Prisma.ProfileOrderByWithRelationInput }>;

const MAX_PAGE = 500;

/** Height choices from 4ft 6in to 7ft in one-inch steps, keyed by cm. */
const HEIGHTS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 31 }, (_, i) => {
    const inches = 54 + i;
    return [String(Math.round(inches * 2.54)), `${Math.floor(inches / 12)}ft ${inches % 12}in`];
  }),
);

const has = (o: Record<string, string>, k?: string): k is string => k !== undefined && Object.hasOwn(o, k);
const inList = (list: string[], v?: string): v is string => v !== undefined && list.includes(v);

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { profile } = await requireProfile();
  const raw = await searchParams;
  // Keep only known, non-empty params so links stay clean.
  const sp: Params = Object.fromEntries(
    KEYS.flatMap((k) => (typeof raw[k] === "string" && raw[k].trim() ? [[k, raw[k].trim()]] : [])),
  );

  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const ageMin = Math.min(80, Math.max(18, Number(sp.ageMin) || 18));
  const ageMax = Math.min(80, Math.max(ageMin, Number(sp.ageMax) || 60));
  const heightMin = has(HEIGHTS, sp.heightMin) ? Number(sp.heightMin) : undefined;
  const heightMax = has(HEIGHTS, sp.heightMax) ? Number(sp.heightMax) : undefined;
  const sortKey = sp.sort && Object.hasOwn(SORTS, sp.sort) ? (sp.sort as keyof typeof SORTS) : "updated";
  const code = sp.code?.toUpperCase();

  // A profile ID lookup ignores every other filter so the member is always found.
  const where: Prisma.ProfileWhereInput = code
    ? { ...browsableWhere(profile), code }
    : {
        ...browsableWhere(profile),
        dateOfBirth: dobRangeForAges(ageMin, ageMax),
        ...((heightMin || heightMax) && { heightCm: { gte: heightMin, lte: heightMax } }),
        ...(inList(STARS, sp.star) && { star: sp.star }),
        ...(inList(RASIS, sp.rasi) && { rasi: sp.rasi }),
        ...(has(DOSHAM_LABELS, sp.dosham) && { dosham: sp.dosham as never }),
        ...(inList(MOTHER_TONGUES, sp.motherTongue) && { motherTongue: sp.motherTongue }),
        ...(has(MARITAL_STATUS_LABELS, sp.maritalStatus) && { maritalStatus: sp.maritalStatus as never }),
        ...(sp.city && { city: { contains: sp.city, mode: "insensitive" } }),
        ...(sp.education && { education: { contains: sp.education, mode: "insensitive" } }),
        ...(sp.withPhoto && { photos: { some: { approved: true } } }),
        ...(sp.excludeGothram && profile.gothram && {
          OR: [{ gothram: null }, { NOT: { gothram: { equals: profile.gothram, mode: "insensitive" } } }],
        }),
      };

  const [total, results, connected] = await Promise.all([
    db.profile.count({ where }),
    db.profile.findMany({
      where,
      include: withPhotos,
      orderBy: [SORTS[sortKey].orderBy, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    connectedIds(profile.id),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: Params) => {
    const qs = new URLSearchParams(p as Record<string, string>).toString();
    return qs ? `/search?${qs}` : "/search";
  };
  const without = (...keys: (keyof Params)[]) => href(Object.fromEntries(Object.entries(sp).filter(([k]) => !keys.includes(k as keyof Params) && k !== "page")));

  const chips: [string, string][] = code
    ? [[`Profile ID: ${code}`, without("code")]]
    : ([
        (sp.ageMin || sp.ageMax) && [`Age ${ageMin}–${ageMax}`, without("ageMin", "ageMax")],
        (heightMin || heightMax) && [
          `Height ${heightMin ? HEIGHTS[heightMin] : "any"} – ${heightMax ? HEIGHTS[heightMax] : "any"}`,
          without("heightMin", "heightMax"),
        ],
        inList(STARS, sp.star) && [`Star: ${sp.star}`, without("star")],
        inList(RASIS, sp.rasi) && [`Rasi: ${sp.rasi}`, without("rasi")],
        has(DOSHAM_LABELS, sp.dosham) && [`Dosham: ${DOSHAM_LABELS[sp.dosham]}`, without("dosham")],
        inList(MOTHER_TONGUES, sp.motherTongue) && [sp.motherTongue, without("motherTongue")],
        has(MARITAL_STATUS_LABELS, sp.maritalStatus) && [MARITAL_STATUS_LABELS[sp.maritalStatus], without("maritalStatus")],
        sp.city && [`City: ${sp.city}`, without("city")],
        sp.education && [`Education: ${sp.education}`, without("education")],
        sp.withPhoto && ["With photo", without("withPhoto")],
        sp.excludeGothram && profile.gothram && [`Not ${profile.gothram} gothram`, without("excludeGothram")],
      ].filter(Boolean) as [string, string][]);
  const moreOpen = Boolean(sp.rasi || sp.dosham || sp.education || sp.withPhoto || sp.excludeGothram);

  return (
    <>
    <PageHeader eyebrow="Discover" title="Search profiles" subtitle="Every profile shown has been reviewed by our team." />
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <Card title="Search by Profile ID">
          <form className="flex gap-2">
            <input
              name="code"
              defaultValue={code}
              placeholder="DM12345"
              aria-label="Profile ID"
              className="block w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm uppercase shadow-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
            />
            <button className="rounded-full bg-maroon px-6 py-2.5 shadow-soft text-sm font-medium text-white hover:bg-maroon-dark">Go</button>
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
            <SelectField label="Star" name="star" options={STARS} defaultValue={sp.star} placeholder="Any" />
            <SelectField label="Mother tongue" name="motherTongue" options={MOTHER_TONGUES} defaultValue={sp.motherTongue} placeholder="Any" />
            <SelectField label="Marital status" name="maritalStatus" options={MARITAL_STATUS_LABELS} defaultValue={sp.maritalStatus} placeholder="Any" />
            <TextField label="City" name="city" defaultValue={sp.city} />

            <details open={moreOpen} className="group rounded-md border border-hairline px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-maroon">More filters</summary>
              <div className="mt-3 space-y-3">
                <SelectField label="Rasi" name="rasi" options={RASIS} defaultValue={sp.rasi} placeholder="Any" />
                <SelectField label="Dosham" name="dosham" options={DOSHAM_LABELS} defaultValue={sp.dosham} placeholder="Any" />
                <TextField label="Education contains" name="education" defaultValue={sp.education} />
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="withPhoto" value="1" defaultChecked={Boolean(sp.withPhoto)} />
                  Only profiles with a photo
                </label>
                {profile.gothram && (
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" name="excludeGothram" value="1" defaultChecked={Boolean(sp.excludeGothram)} />
                    Exclude my gothram ({profile.gothram})
                  </label>
                )}
              </div>
            </details>

            {sp.sort && <input type="hidden" name="sort" value={sortKey} />}
            <div className="flex gap-2 pt-2">
              <button className="rounded-full bg-maroon px-6 py-2.5 shadow-soft text-sm font-medium text-white hover:bg-maroon-dark">Search</button>
              <Link href="/search" className="px-2 py-2 text-sm text-stone-600 underline">Reset</Link>
            </div>
          </form>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-stone-900">{total}</span> profile{total === 1 ? "" : "s"} found
          </p>
          {!code && (
            <form className="flex items-center gap-2 text-sm">
              {Object.entries(sp).map(([k, v]) => k !== "sort" && k !== "page" && <input key={k} type="hidden" name={k} value={v} />)}
              <label htmlFor="sort" className="text-stone-600">Sort by</label>
              <select id="sort" name="sort" defaultValue={sortKey} className="rounded-full border border-hairline bg-white px-3 py-1.5">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
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

        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-white p-10 text-center text-sm text-stone-600">
            {code ? (
              <>No member found with ID <strong>{code}</strong>. Check the ID and try again.</>
            ) : page > pages ? (
              <>This page is past the end of the results. <Link href={href({ ...sp, page: "1" })} className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Go to page 1</Link></>
            ) : (
              <>No profiles match these filters. Try widening the age or height range, or remove a filter above.</>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {results.map((r) => <ProfileCard key={r.id} profile={r} photo={cardPhoto(r, connected)} />)}
          </div>
        )}

        {pages > 1 && page <= pages && (
          <nav className="mt-6 flex items-center justify-center gap-4 text-sm">
            {page > 1 && <Link href={href({ ...sp, page: String(page - 1) })} className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">← Previous</Link>}
            <span>Page {page} of {pages}</span>
            {page < pages && <Link href={href({ ...sp, page: String(page + 1) })} className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Next →</Link>}
          </nav>
        )}
      </div>
    </div>
    </>
  );
}
