import Link from "next/link";
import { setProfileHidden } from "@/app/actions/profile";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { connectedIds } from "@/lib/access";
import { completeness } from "@/lib/completeness";
import { PREMIUM_BENEFITS, isPremium } from "@/lib/premium";
import { db } from "@/lib/db";
import { dobRangeForAges } from "@/lib/format";
import { horoscopeInfo } from "@/lib/horoscope";
import { type TKey, getT, getTx } from "@/lib/i18n";
import { matchScore } from "@/lib/match";
import { browsableWhere, newMatchesWhere, normalizeSearch, searchQueryString, withCard } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Dashboard" };


export default async function DashboardPage() {
  const { user, profile } = await requireProfile();
  const ageFilter =
    profile.prefAgeMin || profile.prefAgeMax
      ? { dateOfBirth: dobRangeForAges(profile.prefAgeMin ?? 18, profile.prefAgeMax ?? 80) }
      : {};
  // All independent queries run in parallel.
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [received, accepted, photoCount, connected, candidates, views, viewCount, shortlistedBy, horoscope, saved] = await Promise.all([
    db.interest.count({ where: { toId: profile.id, status: "PENDING" } }),
    db.interest.count({ where: { status: "ACCEPTED", OR: [{ fromId: profile.id }, { toId: profile.id }] } }),
    db.photo.count({ where: { profileId: profile.id } }),
    connectedIds(profile.id),
    db.profile.findMany({
      where: {
        ...browsableWhere(profile),
        ...ageFilter,
        ...(profile.prefMaritalStatus.length ? { maritalStatus: { in: profile.prefMaritalStatus } } : {}),
        receivedInterests: { none: { fromId: profile.id } },
        ...(profile.gothram && profile.prefExcludeOwnGothram
          ? { OR: [{ gothram: null }, { NOT: { gothram: { equals: profile.gothram, mode: "insensitive" as const } } }] }
          : {}),
      },
      include: withCard,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.profileView.findMany({
      where: { viewedId: profile.id, viewer: browsableWhere(profile) },
      include: { viewer: { include: withCard } },
      orderBy: { viewedAt: "desc" },
      take: 4,
    }),
    db.profileView.count({ where: { viewedId: profile.id, viewedAt: { gte: monthAgo }, viewer: browsableWhere(profile) } }),
    db.shortlist.count({ where: { targetId: profile.id, owner: browsableWhere(profile) } }),
    horoscopeInfo(profile.id),
    db.savedSearch.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const complete = completeness(profile, photoCount, { horoscope: !!horoscope });
  // Best-matching recent members first.
  const matches = candidates
    .map((m) => ({ m, score: matchScore(profile, m).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.m);
  const savedCounts = await Promise.all(
    saved.map(async (s) => {
      const params = normalizeSearch(s.params as Record<string, unknown>);
      const count = await db.profile.count({ where: newMatchesWhere(profile, params, s.lastNotifiedAt ?? s.createdAt) });
      return { s, count, href: `/search?${searchQueryString({ ...params, sort: "newest" })}` };
    }),
  );
  const newFromSaved = savedCounts.filter((x) => x.count > 0);

  const [t, tx] = await Promise.all([getT(), getTx()]);
  const statusLabel = t(`dash.status.${profile.status}` as TKey);
  const statusText = t(`dash.status.${profile.status}.text` as TKey);
  const firstName = profile.name.split(" ")[0];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t(user.isFamilyManager ? "dash.managing" : "dash.profile", { code: profile.code })}
        title={t(user.isFamilyManager ? "dash.managerTitle" : "dash.welcome", { name: firstName })}
        subtitle={t("dash.subtitle")}
      />
      {profile.status === "MARRIED" && (
        <section className="rounded-2xl border border-gold bg-gradient-to-br from-maroon-dark to-maroon p-6 text-white shadow-lift sm:p-8">
          <p className="eyebrow text-gold-light">{t("dash.congrats")}</p>
          <h2 className="mt-1 text-3xl !text-white">{t("dash.marriedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            {t("dash.marriedBody")}
          </p>
          <Link href="/stories" className="mt-4 inline-block rounded-full bg-gold px-5 py-2 text-sm font-semibold text-maroon-dark">{t("dash.shareStory")}</Link>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="eyebrow text-gold-dark">{t("dash.profileStatus")}</p>
          <p className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold text-maroon">
            <span className={`h-2.5 w-2.5 rounded-full ${profile.status === "APPROVED" || profile.status === "MARRIED" ? "bg-emerald-600" : profile.status === "REJECTED" ? "bg-red-600" : "bg-amber-500"}`} aria-hidden />
            {statusLabel}
          </p>
          <p className="mt-1 text-sm text-stone-600">{statusText}</p>
          {(profile.status === "APPROVED" || profile.status === "HIDDEN") && (
            <form action={setProfileHidden.bind(null, profile.status === "APPROVED")} className="mt-2">
              <button className="text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t(profile.status === "APPROVED" ? "dash.hide" : "dash.unhide")}</button>
            </form>
          )}
        </Card>
        <Card>
          <p className="eyebrow text-gold-dark">{t("dash.interests")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-maroon">{received} <span className="text-lg font-medium text-stone-600">{t("dash.awaitingReply")}</span></p>
          <p className="mt-1 text-sm text-stone-600">{t("dash.accepted", { count: accepted })}</p>
          <Link href="/interests" className="mt-2 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t("dash.viewInterests")}</Link>
        </Card>
        <Card>
          <p className="eyebrow text-gold-dark">{t("dash.photos")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-maroon">{photoCount} <span className="text-lg font-medium text-stone-600">{t("dash.uploaded")}</span></p>
          <Link href="/photos" className="mt-2 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            {t(photoCount ? "dash.managePhotos" : "dash.addPhoto")}
          </Link>
        </Card>
        <Card>
          <p className="eyebrow text-gold-dark">{t("dash.visitors")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-maroon">{viewCount} <span className="text-lg font-medium text-stone-600">{t("dash.thisMonth")}</span></p>
          <p className="mt-1 text-sm text-stone-600">{t("dash.shortlistedYou", { count: shortlistedBy })}</p>
          <Link href="/visitors" className="mt-2 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            {t(isPremium(profile) ? "dash.seeWho" : "dash.seeWhoPremium")}
          </Link>
        </Card>
      </div>

      {newFromSaved.length > 0 && (
        <Card>
          <p className="eyebrow text-gold-dark">{t("dash.savedSearches")}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {newFromSaved.map(({ s, count, href }) => (
              <li key={s.id}>
                <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-cream px-4 py-2 text-sm text-maroon transition hover:bg-gold-light/40">
                  {s.name}
                  <span className="rounded-full bg-maroon px-2 py-0.5 text-xs font-semibold text-white">{t("dash.newCount", { count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {complete.missing.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-48 flex-1">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow text-gold-dark">{t("dash.strength")}</p>
                <p className="font-display text-2xl font-semibold text-maroon">{complete.percent}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={complete.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("dash.strength")}>
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-maroon" style={{ width: `${complete.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-stone-500">{t("dash.strengthHint")}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {complete.missing.slice(0, 4).map((m) => (
                <li key={m.label}>
                  <Link href={m.href} className="inline-block rounded-full border border-gold/50 bg-cream px-3.5 py-1.5 text-xs text-maroon transition hover:bg-gold-light/40">
                    + {tx(m.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {(!isPremium(profile) || !profile.idVerifiedAt || !profile.photoVerifiedAt) && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!isPremium(profile) && (
            <Link href="/upgrade" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon-dark to-maroon p-6 text-white shadow-lift transition hover:-translate-y-0.5">
              <p className="eyebrow text-gold-light">{t("dash.premium")}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{t("dash.premiumTitle")}</p>
              <p className="mt-1 text-sm text-white/75">{tx(PREMIUM_BENEFITS[1])}</p>
              <span className="mt-4 inline-block rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-maroon-dark">{t("dash.viewPlans")}</span>
            </Link>
          )}
          {!profile.idVerifiedAt && (
            <Link href="/verify-id" className="group rounded-2xl border border-sky-200 bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-sky-300">
              <p className="eyebrow text-sky-800">{t("dash.trustBadge")}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink">{t("dash.idTitle")}</p>
              <p className="mt-1 text-sm text-stone-600">{t("dash.idBody")}</p>
              <span className="mt-4 inline-block text-sm font-medium text-sky-800">{t("dash.verifyNow")}</span>
            </Link>
          )}
          {!profile.photoVerifiedAt && photoCount > 0 && (
            <Link href="/verify-photo" className="group rounded-2xl border border-violet-200 bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-violet-300">
              <p className="eyebrow text-violet-800">{t("dash.trustBadge")}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink">{t("dash.photoTitle")}</p>
              <p className="mt-1 text-sm text-stone-600">{t("dash.photoBody")}</p>
              <span className="mt-4 inline-block text-sm font-medium text-violet-800">{t("dash.takeSelfie")}</span>
            </Link>
          )}
        </div>
      )}

      {views.length > 0 && (
        <>
          <div className="pt-6">
            <p className="eyebrow text-gold-dark">{t("dash.interestInYou")}</p>
            <h2 className="mt-1 text-3xl text-maroon">{t("dash.recentlyViewed")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {views.map((v) => <ProfileCard key={v.id} profile={v.viewer} photo={cardPhoto(v.viewer, connected)} viewer={profile} />)}
          </div>
        </>
      )}

      <div className="flex items-end justify-between pt-6">
        <div>
          <p className="eyebrow text-gold-dark">{t("dash.curated")}</p>
          <h2 className="mt-1 text-3xl text-maroon">{t("dash.matches")}</h2>
        </div>
        <Link href="/search" className="text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t("dash.searchAll")}</Link>
      </div>
      {matches.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {matches.map((m) => <ProfileCard key={m.id} profile={m} photo={cardPhoto(m, connected)} viewer={profile} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gold/40 bg-white px-6 py-10 text-center">
          <p className="font-display text-2xl text-maroon">{t("dash.noMatches")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{t("dash.noMatchesBody")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/profile/edit#preferences" className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">{t("dash.editPrefs")}</Link>
            <Link href="/search" className="rounded-full bg-maroon px-5 py-2 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("dash.searchProfiles")}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
