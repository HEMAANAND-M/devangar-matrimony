import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { deleteStory, saveFaq, saveSafety, saveStory, saveTestimonials, setStoryPublished } from "@/app/actions/admin-content";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, EmptyState, Panel, buttonCls, inputCls } from "@/components/admin/ui";
import { formatSafety, getFaq, getSafety, getTestimonials } from "@/lib/content";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Content" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";
const f = `${inputCls} mt-1 w-full`;
const TABS: [string, string][] = [["stories", "Success stories"], ["testimonials", "Testimonials"], ["faq", "FAQ"], ["safety", "Safety page"]];

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: raw } = await searchParams;
  const tab = TABS.some(([k]) => k === raw) ? raw! : "stories";

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Content" description="Public pages and stories. Changes are live as soon as you save." />
      <nav className="flex flex-wrap gap-1 border-b border-hairline" aria-label="Content sections">
        {TABS.map(([key, text]) => (
          <Link
            key={key}
            href={`/admin/content${key === "stories" ? "" : `?tab=${key}`}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${tab === key ? "border-maroon font-medium text-maroon" : "border-transparent text-stone-600 hover:text-maroon"}`}
          >
            {text}
          </Link>
        ))}
      </nav>
      {tab === "stories" && <Stories />}
      {tab === "testimonials" && <Testimonials />}
      {tab === "faq" && <FaqEditor />}
      {tab === "safety" && <SafetyEditor />}
    </div>
  );
}

type Story = Prisma.SuccessStoryGetPayload<{ omit: { photo: true } }> & { hasPhoto: boolean };

function StoryFields({ s }: { s?: Story }) {
  return (
    <>
      <label className="block text-xs font-medium text-stone-600">
        Couple’s names
        <input name="coupleNames" required maxLength={120} defaultValue={s?.coupleNames} placeholder="Priya & Karthik" className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Story
        <textarea name="story" required rows={5} maxLength={3000} defaultValue={s?.story} className={f} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-stone-600">
          City
          <input name="city" maxLength={60} defaultValue={s?.city ?? ""} className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Wedding date
          <input type="date" name="weddingDate" defaultValue={s?.weddingDate ? s.weddingDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : ""} className={f} />
        </label>
      </div>
      <label className="block text-xs font-medium text-stone-600">
        Photo (JPEG, PNG or WebP, up to 5 MB)
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sand file:px-3 file:py-2 file:text-sm file:text-maroon" />
      </label>
      {s?.hasPhoto && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="removePhoto" className="accent-maroon" /> Remove current photo
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="published" defaultChecked={s ? s.published : true} className="accent-maroon" /> Published
      </label>
    </>
  );
}

async function Stories() {
  const rows = await db.successStory.findMany({ omit: { photo: true }, orderBy: [{ published: "asc" }, { createdAt: "desc" }], take: 100 });
  // Fetch only which stories have a photo, never the bytes.
  const withPhoto = new Set(
    (await db.successStory.findMany({ where: { photo: { not: null } }, select: { id: true } })).map((r) => r.id),
  );
  const stories: Story[] = rows.map((r) => ({ ...r, hasPhoto: withPhoto.has(r.id) }));
  const pending = stories.filter((s) => !s.published && s.profileId).length;
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Panel title="Add a story">
        <ActionForm action={saveStory.bind(null, null)} className="space-y-3">
          <StoryFields />
          <SubmitButton className={`${SUBMIT} w-full`}>Add story</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel
        title={`Stories (${stories.length})`}
        description={pending ? `${pending} submitted by members awaiting review` : "Stories submitted by members appear here unpublished."}
        actions={<Link href="/stories" className={buttonCls.ghost}>View public page</Link>}
      >
        {stories.length ? (
          <ul className="divide-y divide-hairline">
            {stories.map((s) => (
              <li key={s.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                {s.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
                  <img src={`/api/stories/${s.id}`} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-sand font-display text-2xl text-gold-dark" aria-hidden>♥</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {s.coupleNames}
                      <Badge tone={s.published ? "green" : "amber"}>{s.published ? "Published" : "Draft"}</Badge>
                      {s.profileId && <Badge tone="blue">Member submitted</Badge>}
                    </p>
                    <span className="flex gap-1">
                      <ActionButton variant="ghost" action={setStoryPublished.bind(null, s.id, !s.published)}>{s.published ? "Unpublish" : "Publish"}</ActionButton>
                      <ActionButton variant="ghost" confirm="Delete this story?" action={deleteStory.bind(null, s.id)}>Delete</ActionButton>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{s.story}</p>
                  <p className="mt-1 text-xs text-stone-500">{[s.city, s.weddingDate && `Married ${dateOnly(s.weddingDate)}`].filter(Boolean).join(" · ") || `Added ${dateOnly(s.createdAt)}`}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-maroon">Edit</summary>
                    <ActionForm action={saveStory.bind(null, s.id)} className="mt-3 space-y-3 rounded-lg bg-cream/50 p-4">
                      <StoryFields s={s} />
                      <SubmitButton className={SUBMIT}>Save changes</SubmitButton>
                    </ActionForm>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No success stories yet">Add stories from couples who met here, with their permission.</EmptyState>
        )}
      </Panel>
    </div>
  );
}

async function Testimonials() {
  const list = await getTestimonials();
  const rows = [...list, null, null];
  return (
    <Panel title="Homepage testimonials" description="Shown on the homepage only when at least one is added. Use real quotes from families, with their consent. Clear a row’s names to remove it.">
      <ActionForm action={saveTestimonials} className="space-y-4">
        <input type="hidden" name="count" value={rows.length} />
        {rows.map((t, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-hairline p-4 sm:grid-cols-[1fr_1fr]">
            <label className="block text-xs font-medium text-stone-600">
              Family / couple names
              <input name={`names_${i}`} defaultValue={t?.names} className={f} placeholder={t ? "" : "Add a testimonial"} />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              City
              <input name={`city_${i}`} defaultValue={t?.city ?? ""} className={f} />
            </label>
            <label className="block text-xs font-medium text-stone-600 sm:col-span-2">
              Quote
              <textarea name={`quote_${i}`} rows={2} maxLength={500} defaultValue={t?.quote} className={f} />
            </label>
          </div>
        ))}
        <SubmitButton className={SUBMIT}>Save testimonials</SubmitButton>
      </ActionForm>
    </Panel>
  );
}

async function FaqEditor() {
  const faq = await getFaq();
  const rows = [...faq, null, null];
  return (
    <Panel title="Frequently asked questions" description="Clear a question to remove it." actions={<Link href="/faq" className={buttonCls.ghost}>View public page</Link>}>
      <ActionForm action={saveFaq} className="space-y-4">
        <input type="hidden" name="count" value={rows.length} />
        {rows.map((q, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-hairline p-4">
            <label className="block text-xs font-medium text-stone-600">
              Question {i + 1}
              <input name={`q_${i}`} defaultValue={q?.q} maxLength={200} className={f} placeholder={q ? "" : "Add a question"} />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Answer
              <textarea name={`a_${i}`} rows={3} maxLength={1500} defaultValue={q?.a} className={f} />
            </label>
          </div>
        ))}
        <SubmitButton className={SUBMIT}>Save FAQ</SubmitButton>
      </ActionForm>
    </Panel>
  );
}

async function SafetyEditor() {
  const sections = await getSafety();
  return (
    <Panel
      title="Safety guidelines"
      description="Start each section with a line beginning “## ”, then one point per line."
      actions={<Link href="/safety" className={buttonCls.ghost}>View public page</Link>}
    >
      <ActionForm action={saveSafety} className="space-y-3">
        <textarea name="text" rows={22} defaultValue={formatSafety(sections)} className={`${inputCls} w-full font-mono text-[0.8rem] leading-relaxed`} />
        <SubmitButton className={SUBMIT}>Save safety page</SubmitButton>
      </ActionForm>
    </Panel>
  );
}
