import Link from "next/link";
import type { Advertisement } from "@prisma/client";
import { deleteAd, moveAd, saveAd } from "@/app/actions/admin-ads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, EmptyState, Panel, buttonCls, inputCls } from "@/components/admin/ui";
import { AD_CATEGORIES, AD_CATEGORY_LABELS, AD_HEIGHT, AD_WIDTH, adImageUrl } from "@/lib/ads";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Advertisements" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";
const f = `${inputCls} mt-1 w-full`;
/** Value for a date input, in IST. */
const day = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");

type AdRow = Omit<Advertisement, "image">;

function AdFields({ ad }: { ad?: AdRow }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-stone-600">
          Advertiser
          <input name="advertiser" required maxLength={120} defaultValue={ad?.advertiser} placeholder="Lakshmi Studios" className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Category
          <select name="category" defaultValue={ad?.category ?? "PHOTOGRAPHER"} className={f}>
            {AD_CATEGORIES.map((c) => <option key={c} value={c}>{AD_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-stone-600">
        Title
        <input name="title" required maxLength={120} defaultValue={ad?.title} placeholder="Candid wedding photography" className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Tagline (optional)
        <input name="tagline" maxLength={160} defaultValue={ad?.tagline ?? ""} placeholder="10% off for Devangar Matrimony members" className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Link (optional, https only)
        <input name="href" defaultValue={ad?.href ?? ""} placeholder="https://…" className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Banner image {ad ? "(leave empty to keep the current one)" : ""}
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required={!ad} className={`${f} file:mr-3 file:rounded-md file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-sm`} />
        <span className="mt-1 block font-normal text-stone-500">
          {AD_WIDTH} × {AD_HEIGHT} px recommended (8:3). Larger images are cropped to fit. JPEG, PNG or WebP, up to 5 MB.
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-stone-600">
          Starts (optional)
          <input type="date" name="startsAt" defaultValue={day(ad?.startsAt ?? null)} className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Ends (optional)
          <input type="date" name="endsAt" defaultValue={day(ad?.endsAt ?? null)} className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Order
          <input type="number" name="sortOrder" min={0} max={9999} defaultValue={ad?.sortOrder ?? 0} className={f} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="active" defaultChecked={ad ? ad.active : true} className="accent-maroon" /> Active
      </label>
    </>
  );
}

function status(ad: AdRow, now: Date): [string, "green" | "amber" | "neutral" | "blue"] {
  if (!ad.active) return ["Paused", "neutral"];
  if (ad.startsAt && ad.startsAt > now) return ["Scheduled", "blue"];
  if (ad.endsAt && ad.endsAt <= now) return ["Ended", "amber"];
  return ["Live", "green"];
}

export default async function AdminAdsPage() {
  await requireAdmin();
  const ads = await db.advertisement.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    omit: { image: true },
  });
  const now = new Date();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Advertisements"
        description="Sponsored banners for wedding services, shown in the carousel on the home page below “How it works”."
        actions={<Link href="/" className={buttonCls.secondary}>View home page</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Panel title="New advertisement">
          <ActionForm action={saveAd.bind(null, null)} className="space-y-3">
            <AdFields />
            <SubmitButton className={`${SUBMIT} w-full`}>Add advertisement</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title={`Advertisements (${ads.length})`} description="Shown in this order. Only live ads appear on the site." flush>
          {ads.length ? (
            <ul className="divide-y divide-hairline">
              {ads.map((ad, i) => {
                const [label, tone] = status(ad, now);
                const ctr = ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0.0";
                return (
                  <li key={ad.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by an access-checked route */}
                      <img src={adImageUrl(ad)} alt="" loading="lazy" className="aspect-[8/3] w-48 shrink-0 rounded-lg border border-hairline object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                          {ad.title}
                          <Badge tone={tone}>{label}</Badge>
                          <Badge tone="gold">{AD_CATEGORY_LABELS[ad.category]}</Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {ad.advertiser}
                          {(ad.startsAt || ad.endsAt) && <> · {ad.startsAt ? dateOnly(ad.startsAt) : "now"} → {ad.endsAt ? dateOnly(ad.endsAt) : "no end"}</>}
                          {ad.href && <> · <a href={ad.href} target="_blank" rel="noopener noreferrer" className="text-maroon hover:underline">link ↗</a></>}
                        </p>
                        <p className="mt-2 text-xs tabular-nums text-stone-600">
                          {ad.impressions.toLocaleString("en-IN")} views · {ad.clicks.toLocaleString("en-IN")} clicks · {ctr}% CTR
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActionButton variant="ghost" action={moveAd.bind(null, ad.id, "up")} doneLabel="Moved" className={i === 0 ? "invisible" : ""}>↑</ActionButton>
                        <ActionButton variant="ghost" action={moveAd.bind(null, ad.id, "down")} doneLabel="Moved" className={i === ads.length - 1 ? "invisible" : ""}>↓</ActionButton>
                        <ActionButton variant="ghost" confirm="Delete this advertisement?" action={deleteAd.bind(null, ad.id)}>Delete</ActionButton>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-maroon">Edit</summary>
                      <ActionForm action={saveAd.bind(null, ad.id)} className="mt-3 space-y-3 rounded-lg bg-cream/50 p-4">
                        <AdFields ad={ad} />
                        <SubmitButton className={SUBMIT}>Save changes</SubmitButton>
                      </ActionForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No advertisements yet">Add banners for wedding planners, photographers, venues and other services families need.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
