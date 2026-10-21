import { notFound } from "next/navigation";
import { after } from "next/server";
import { blockFromForm, reportProfile, sendInterest, toggleShortlist } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActiveIndicator, IdVerifiedBadge, MatchBadge, PhoneVerifiedBadge, PhotoVerifiedBadge, PremiumBadge } from "@/components/Badges";
import { Card } from "@/components/Card";
import { ContactRequestPanel } from "@/components/ContactRequestPanel";
import { MessageButton } from "@/components/MessageButton";
import { RasiChart } from "@/components/RasiChart";
import { ProtectedPhoto } from "@/components/ProtectedPhoto";
import { PoruthamCard } from "@/components/PoruthamCard";
import { SelectField, TextArea } from "@/components/fields";
import { isBlocked, isConnected, visiblePhotos } from "@/lib/access";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, PROFILE_FOR_LABELS, REPORT_CATEGORY_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ageFrom, heightLabel } from "@/lib/format";
import { canViewHoroscope, horoscopeInfo } from "@/lib/horoscope";
import { type TKey, getT, getTx } from "@/lib/i18n";
import { matchScore } from "@/lib/match";
import { porutham } from "@/lib/porutham";
import { isPremium } from "@/lib/premium";
import { withPhotos } from "@/lib/queries";
import { HOUR, rateLimit } from "@/lib/rate-limit";
import { isStaff, requireProfile } from "@/lib/session";
import { signedPhotoUrl } from "@/lib/photo-url";

function Facts({ rows, empty = "Not added yet" }: { rows: [string, string | null | undefined][]; empty?: string }) {
  if (!rows.some(([, v]) => v)) return <p className="text-sm italic text-stone-400">{empty}</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-28 shrink-0 text-stone-500 sm:w-36">{k}</dt>
          <dd className="min-w-0 break-words text-stone-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  // The ID only: member names stay out of browser history and tab titles.
  return { title: `Profile ${(await params).code}` };
}

const FREE_DAILY_VIEWS = 150;
const PREMIUM_DAILY_VIEWS = 400;

export default async function ProfilePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user, profile: me } = await requireProfile();
  const isAdmin = isStaff(user);
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const list = (values: string[]) => values.map(tx).join(", ");

  const p = await db.profile.findUnique({ where: { code }, include: { ...withPhotos, user: { select: { phone: true, phoneVerified: true, lastActiveAt: true } } } });
  const isSelf = p?.id === me.id;
  if (!p || (!isSelf && !isAdmin && (p.status !== "APPROVED" || p.gender === me.gender))) notFound();
  if (!isSelf && !isAdmin && (await isBlocked(me.id, p.id))) notFound();

  // Caps how many profiles one account can open per day, so a fake account cannot harvest the
  // community's profiles and photos in bulk. Genuine members rarely come close.
  if (!isSelf && !isAdmin && !(await rateLimit(`profile-views:${me.id}`, isPremium(me) ? PREMIUM_DAILY_VIEWS : FREE_DAILY_VIEWS, 24 * HOUR))) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-maroon">{t("pv.limitTitle")}</h1>
        <p className="mt-3 text-sm text-stone-600">{t("pv.limitBody")}</p>
      </Card>
    );
  }

  if (!isSelf && !isAdmin) {
    // Recorded after the response is sent so it never slows the page.
    after(() =>
      db.profileView.upsert({
        where: { viewerId_viewedId: { viewerId: me.id, viewedId: p.id } },
        create: { viewerId: me.id, viewedId: p.id },
        update: { viewedAt: new Date() },
      }),
    );
  }

  const [connected, sent, received, shortlisted, horoscope, horoscopeAllowed] = await Promise.all([
    isConnected(me.id, p.id),
    db.interest.findUnique({ where: { fromId_toId: { fromId: me.id, toId: p.id } } }),
    db.interest.findUnique({ where: { fromId_toId: { fromId: p.id, toId: me.id } } }),
    db.shortlist.findUnique({ where: { ownerId_targetId: { ownerId: me.id, targetId: p.id } } }),
    horoscopeInfo(p.id),
    canViewHoroscope(p, { profileId: me.id, gender: me.gender, isStaff: isAdmin }),
  ]);
  const photos = visiblePhotos(p, { profileId: me.id, isAdmin }, connected);
  const hiddenPhotos = !photos.length && p.photos.some((ph) => ph.approved) && p.photoVisibility === "ACCEPTED_ONLY";
  const match = isSelf ? null : me.gender === "FEMALE" ? porutham(me, p) : porutham(p, me);
  const fit = isSelf || me.gender === p.gender ? null : matchScore(me, p);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
          {photos.length ? (
            <div className="grid gap-1">
              {photos.map((ph) =>
                isSelf ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
                  <img key={ph.id} src={signedPhotoUrl(ph.id)} alt={p.name} decoding="async" className="w-full object-cover" />
                ) : (
                  <ProtectedPhoto key={ph.id} src={signedPhotoUrl(ph.id)} alt={p.name} />
                ),
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-stone-100 p-6 text-center text-sm text-stone-500">
              {t(hiddenPhotos ? "pv.photosOnAccept" : "pv.noPhoto")}
            </div>
          )}
        </div>

        {!isSelf && (
          <Card>
            {connected ? (
              <div className="text-sm">
                <p className="font-semibold text-green-700">{t("pv.connected")}</p>
                {/* Members' numbers are shared only through an approved contact request (below). */}
                {isAdmin && <p className="mt-1">{t("pv.staffContact")} <a href={`tel:${p.user.phone}`} className="font-medium text-maroon">{p.user.phone}</a></p>}
              </div>
            ) : sent ? (
              <p className="text-sm text-stone-700">{t("pv.interestSent", { status: t(`pv.status.${sent.status.toLowerCase()}` as TKey) })}</p>
            ) : received ? (
              <p className="text-sm text-stone-700">{t("pv.receivedInterest")}</p>
            ) : (
              <ActionForm action={sendInterest.bind(null, p.id)} className="space-y-3">
                <TextArea label={t("pv.message")} name="message" maxLength={300} placeholder={t("pv.messagePlaceholder")} />
                <SubmitButton className="w-full">{t("pv.sendInterest")}</SubmitButton>
              </ActionForm>
            )}
            <div className="mt-3 space-y-3 empty:hidden">
              <MessageButton viewerProfileId={me.id} targetProfileId={p.id} />
              <ContactRequestPanel viewerProfileId={me.id} targetProfileId={p.id} />
            </div>
            <form action={toggleShortlist.bind(null, p.id)} className="mt-3">
              <button className="w-full rounded-full border border-gold/60 px-4 py-2.5 transition hover:bg-gold-light/30 text-sm text-maroon">
                {t(shortlisted ? "pv.shortlisted" : "pv.addShortlist")}
              </button>
            </form>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="border-b border-hairline pb-5">
          <p className="eyebrow text-gold-dark">{p.code}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-4xl text-maroon sm:text-5xl">
            {p.name}
            {p.status === "APPROVED" && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-sans text-xs font-medium tracking-normal text-emerald-800">
                {t("pv.reviewed")}
              </span>
            )}
          </h1>
          <p className="mt-2 text-stone-600">
            {t("common.yrs", { age: ageFrom(p.dateOfBirth) })} · {p.occupation} · {p.city}, {p.state}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {fit && <MatchBadge score={fit.score} />}
            {p.user.phoneVerified && <PhoneVerifiedBadge />}
            {p.idVerifiedAt && <IdVerifiedBadge />}
            {p.photoVerifiedAt && <PhotoVerifiedBadge />}
            {isPremium(p) && <PremiumBadge />}
            <ActiveIndicator lastActiveAt={p.user.lastActiveAt} className="ml-1" />
          </div>
        </div>
        {fit && (
          <section className="rounded-2xl border border-hairline bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl text-maroon">{t("pv.whyMatch")}</h2>
              <p className="font-display text-3xl font-semibold text-maroon">{fit.score}<span className="text-base font-medium text-stone-500">{t("pv.percentMatch")}</span></p>
            </div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <ul className="space-y-1.5">
                {fit.reasons.map((r) => <li key={r} className="flex gap-2 text-stone-700"><span className="text-emerald-600" aria-hidden>✓</span>{tx(r)}</li>)}
                {!fit.reasons.length && <li className="text-stone-500">{t("pv.addPrefs")}</li>}
              </ul>
              {fit.concerns.length > 0 && (
                <ul className="space-y-1.5">
                  {fit.concerns.map((c) => <li key={c} className="flex gap-2 text-stone-600"><span className="text-amber-600" aria-hidden>•</span>{tx(c)}</li>)}
                </ul>
              )}
            </div>
            <p className="mt-4 text-xs text-stone-500">{t("pv.matchBasis")}</p>
          </section>
        )}
        {match && <PoruthamCard report={match} />}
        {!isSelf && !match && (
          <p className="rounded-xl border border-dashed border-hairline bg-white px-4 py-3 text-sm text-stone-600">
            {t("pv.addStar")}
          </p>
        )}
        {p.about && <Card title={t("pv.about")}><p className="whitespace-pre-line text-sm text-stone-700">{p.about}</p></Card>}
        <Card title={t("pv.basic")}>
          <Facts empty={t("pv.notProvided")} rows={[
            [t("pv.createdBy"), tx(PROFILE_FOR_LABELS[p.profileFor])],
            [t("pv.maritalStatus"), tx(MARITAL_STATUS_LABELS[p.maritalStatus])],
            [t("pv.height"), heightLabel(p.heightCm)],
            [t("pv.motherTongue"), tx(p.motherTongue)],
            [t("pv.subSect"), p.subSect],
          ]} />
        </Card>
        <Card title={t("pv.lifestyle")}>
          <Facts empty={t("pv.notProvided")} rows={[[t("pv.diet"), p.diet && tx(p.diet)], [t("pv.complexion"), p.complexion && tx(p.complexion)], [t("pv.languages"), list(p.languages)]]} />
        </Card>
        <Card title={t("pv.community")}>
          <Facts empty={t("pv.notProvided")} rows={[
            [t("pv.gothram"), p.gothram],
            [t("pv.kuladeivam"), p.kuladeivam],
            [t("pv.star"), p.star && tx(p.star)],
            [t("pv.rasi"), p.rasi && tx(p.rasi)],
            [t("pv.lagnam"), p.lagnam && tx(p.lagnam)],
            [t("pv.dosham"), tx(DOSHAM_LABELS[p.dosham])],
            [t("pv.birthPlace"), p.birthPlace],
            [t("pv.birthTime"), p.birthTime],
          ]} />
          {(p.rasi || p.lagnam || horoscope) && (
            <div className="mt-6 flex flex-wrap items-start gap-6 border-t border-hairline pt-6">
              <RasiChart rasi={p.rasi} lagnam={p.lagnam} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="eyebrow text-gold-dark">{t("pv.horoscope")}</p>
                {horoscope && horoscopeAllowed ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`/api/horoscope/${p.id}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-maroon px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-maroon-dark">{t("pv.viewHoroscope")}</a>
                    <a href={`/api/horoscope/${p.id}?download=1`} className="rounded-full border border-gold/60 px-4 py-2 text-xs text-maroon hover:bg-gold-light/30">{t("pv.download")}</a>
                  </div>
                ) : horoscope ? (
                  <p className="mt-2 text-stone-600">{t("pv.horoscopeOnAccept")}</p>
                ) : (
                  <p className="mt-2 text-stone-500">{t("pv.noHoroscope")}</p>
                )}
              </div>
            </div>
          )}
        </Card>
        <Card title={t("pv.education")}>
          <Facts empty={t("pv.notProvided")} rows={[[t("pv.educationLabel"), p.education], [t("pv.occupation"), p.occupation], [t("pv.income"), p.annualIncome]]} />
        </Card>
        <Card title={t("pv.family")}>
          <Facts empty={t("pv.notProvided")} rows={[
            [t("pv.father"), [p.fatherName, p.fatherOccupation].filter(Boolean).join(" · ")],
            [t("pv.mother"), [p.motherName, p.motherOccupation].filter(Boolean).join(" · ")],
            [t("pv.siblings"), p.siblings],
            [t("pv.familyType"), p.familyType && tx(p.familyType)],
            [t("pv.familyStatus"), p.familyStatus && tx(p.familyStatus)],
            [t("pv.nativePlace"), p.nativePlace],
          ]} />
        </Card>
        <Card title={t("pv.preferences")}>
          <Facts empty={t("pv.notProvided")} rows={[
            [t("pv.age"), p.prefAgeMin || p.prefAgeMax ? t("pv.ageRange", { min: p.prefAgeMin ?? 18, max: p.prefAgeMax ?? t("common.any") }) : null],
            [t("pv.maritalStatus"), list(p.prefMaritalStatus.map((m) => MARITAL_STATUS_LABELS[m]))],
            [t("pv.stars"), list(p.prefStars)],
            [t("pv.dosham"), p.prefDosham === "NO" ? t("pv.prefersNoDosham") : p.prefDosham === "YES" ? t("pv.prefersDosham") : null],
            [t("pv.cities"), p.prefCities.join(", ")],
            [t("pv.educationLabel"), p.prefEducation],
            [t("pv.gothram"), p.prefExcludeOwnGothram && p.gothram ? t("pv.differentGothram") : null],
            [t("pv.other"), p.prefNotes],
          ]} />
        </Card>
        {!isSelf && (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-2 text-sm text-stone-600">
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer hover:text-maroon">{t("pv.report")}</summary>
              <ActionForm action={reportProfile.bind(null, p.id)} className="mt-3 space-y-3">
                <SelectField label={t("pv.reportReason")} name="category" options={Object.fromEntries(Object.entries(REPORT_CATEGORY_LABELS).map(([k, v]) => [k, tx(v)]))} required placeholder={t("pv.chooseReason")} />
                <TextArea label={t("pv.reportDetails")} name="reason" required minLength={10} maxLength={1000} />
                <SubmitButton variant="danger">{t("pv.submitReport")}</SubmitButton>
              </ActionForm>
            </details>
            <ActionForm action={blockFromForm.bind(null, p.id)} confirm={t("pv.blockConfirm")}>
              <button type="submit" className="hover:text-red-700">{t("pv.block")}</button>
            </ActionForm>
          </div>
        )}
      </div>
    </div>
  );
}
