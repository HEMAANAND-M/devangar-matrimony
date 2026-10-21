import Link from "next/link";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { connectedIds } from "@/lib/access";
import { db } from "@/lib/db";
import { isPremium } from "@/lib/premium";
import { browsableWhere, withCard } from "@/lib/queries";
import { isStaff, requireProfile } from "@/lib/session";
import { type T, getT } from "@/lib/i18n";

export const metadata = { title: "Visitors" };

const LIMIT = 48;

/** Placeholder cards for free members: they reveal nothing about the real visitors. */
function LockedGrid({ count, t }: { count: number; t: T }) {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4" aria-hidden>
        {Array.from({ length: Math.min(count, 4) }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
            <div className="aspect-[4/5] bg-gradient-to-br from-sand to-gold-light/60 blur-[2px]" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 rounded bg-stone-200" />
              <div className="h-3 w-1/3 rounded bg-stone-100" />
              <div className="h-3 w-1/2 rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl border border-gold/50 bg-white/95 p-6 text-center shadow-lift backdrop-blur">
          <p className="eyebrow text-gold-dark">{t("visitors.premium")}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-maroon">{t("visitors.lockedTitle")}</p>
          <p className="mt-1 text-sm text-stone-600">{t("visitors.lockedBody")}</p>
          <Link href="/upgrade" className="mt-4 inline-block rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("visitors.viewPlans")}</Link>
        </div>
      </div>
    </div>
  );
}

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireProfile();
  const tab = (await searchParams).tab === "shortlisted" ? "shortlisted" : "viewed";
  const unlocked = isPremium(profile) || isStaff(user);
  const visible = browsableWhere(profile);

  const [viewCount, shortlistCount, connected] = await Promise.all([
    db.profileView.count({ where: { viewedId: profile.id, viewer: visible } }),
    db.shortlist.count({ where: { targetId: profile.id, owner: visible } }),
    connectedIds(profile.id),
  ]);
  // Free members never receive the visitors' data, not even hidden in the page.
  const people = !unlocked
    ? []
    : tab === "viewed"
      ? (
          await db.profileView.findMany({
            where: { viewedId: profile.id, viewer: visible },
            include: { viewer: { include: withCard } },
            orderBy: { viewedAt: "desc" },
            take: LIMIT,
          })
        ).map((v) => ({ key: v.id, p: v.viewer, when: v.viewedAt }))
      : (
          await db.shortlist.findMany({
            where: { targetId: profile.id, owner: visible },
            include: { owner: { include: withCard } },
            orderBy: { createdAt: "desc" },
            take: LIMIT,
          })
        ).map((s) => ({ key: s.id, p: s.owner, when: s.createdAt }));
  const count = tab === "viewed" ? viewCount : shortlistCount;
  const t = await getT();

  const tabCls = (t: string) =>
    `rounded-full px-4 py-2 text-sm transition sm:px-5 ${tab === t ? "bg-maroon text-white shadow-soft" : "text-stone-600 hover:text-maroon"}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("visitors.eyebrow")} title={t("visitors.title")} subtitle={t("visitors.subtitle")} />
      <div className="inline-flex gap-1 rounded-full border border-hairline bg-white p-1 shadow-soft">
        <Link href="/visitors" className={tabCls("viewed")}>{t("visitors.viewedTab", { count: viewCount })}</Link>
        <Link href="/visitors?tab=shortlisted" className={tabCls("shortlisted")}>{t("visitors.shortlistedTab", { count: shortlistCount })}</Link>
      </div>

      {count === 0 ? (
        <Card>
          <div className="py-6 text-center">
            <p className="font-display text-2xl text-maroon">{t(tab === "viewed" ? "visitors.noViews" : "visitors.noShortlists")}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
              {t("visitors.emptyBody")}
            </p>
            <Link href="/profile/edit" className="mt-4 inline-block rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">{t("visitors.improve")}</Link>
          </div>
        </Card>
      ) : unlocked ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {people.map(({ key, p, when }) => (
            <div key={key} className="space-y-1.5">
              <ProfileCard profile={p} photo={cardPhoto(p, connected)} viewer={profile} />
              <p className="px-1 text-xs text-stone-500">
                {t(tab === "viewed" ? "visitors.viewedOn" : "visitors.shortlistedOn", { date: when.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <LockedGrid count={count} t={t} />
      )}
    </div>
  );
}
