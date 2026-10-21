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
import { ageFrom, heightLabel, photoUrl } from "@/lib/format";
import { canViewHoroscope, horoscopeInfo } from "@/lib/horoscope";
import { matchScore } from "@/lib/match";
import { porutham } from "@/lib/porutham";
import { isPremium } from "@/lib/premium";
import { withPhotos } from "@/lib/queries";
import { HOUR, rateLimit } from "@/lib/rate-limit";
import { isStaff, requireProfile } from "@/lib/session";

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  if (!rows.some(([, v]) => v)) return <p className="text-sm italic text-stone-400">Not added yet</p>;
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

  const p = await db.profile.findUnique({ where: { code }, include: { ...withPhotos, user: { select: { phone: true, phoneVerified: true, lastActiveAt: true } } } });
  const isSelf = p?.id === me.id;
  if (!p || (!isSelf && !isAdmin && (p.status !== "APPROVED" || p.gender === me.gender))) notFound();
  if (!isSelf && !isAdmin && (await isBlocked(me.id, p.id))) notFound();

  // Caps how many profiles one account can open per day, so a fake account cannot harvest the
  // community's profiles and photos in bulk. Genuine members rarely come close.
  if (!isSelf && !isAdmin && !(await rateLimit(`profile-views:${me.id}`, isPremium(me) ? PREMIUM_DAILY_VIEWS : FREE_DAILY_VIEWS, 24 * HOUR))) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-maroon">Daily profile limit reached</h1>
        <p className="mt-3 text-sm text-stone-600">
          To protect our members’ privacy, each account can open a limited number of profiles a day. Please come back
          tomorrow — your shortlist and interests are still available.
        </p>
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
                  <img key={ph.id} src={photoUrl(ph.id)} alt={p.name} decoding="async" className="w-full object-cover" />
                ) : (
                  <ProtectedPhoto key={ph.id} src={photoUrl(ph.id)} alt={p.name} />
                ),
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-stone-100 p-6 text-center text-sm text-stone-500">
              {hiddenPhotos ? "Photos are visible after this member accepts your interest." : "No photo added yet."}
            </div>
          )}
        </div>

        {!isSelf && (
          <Card>
            {connected ? (
              <div className="text-sm">
                <p className="font-semibold text-green-700">You are connected</p>
                {/* Members' numbers are shared only through an approved contact request (below). */}
                {isAdmin && <p className="mt-1">Contact (staff view): <a href={`tel:${p.user.phone}`} className="font-medium text-maroon">{p.user.phone}</a></p>}
              </div>
            ) : sent ? (
              <p className="text-sm text-stone-700">Interest sent · {sent.status.toLowerCase()}</p>
            ) : received ? (
              <p className="text-sm text-stone-700">This member has sent you an interest. Respond from the Interests page.</p>
            ) : (
              <ActionForm action={sendInterest.bind(null, p.id)} className="space-y-3">
                <TextArea label="Message (optional)" name="message" maxLength={300} placeholder="Introduce yourself or your family" />
                <SubmitButton className="w-full">Send interest</SubmitButton>
              </ActionForm>
            )}
            <div className="mt-3 space-y-3 empty:hidden">
              <MessageButton viewerProfileId={me.id} targetProfileId={p.id} />
              <ContactRequestPanel viewerProfileId={me.id} targetProfileId={p.id} />
            </div>
            <form action={toggleShortlist.bind(null, p.id)} className="mt-3">
              <button className="w-full rounded-full border border-gold/60 px-4 py-2.5 transition hover:bg-gold-light/30 text-sm text-maroon">
                {shortlisted ? "★ Shortlisted" : "☆ Add to shortlist"}
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
                ✓ Verified
              </span>
            )}
          </h1>
          <p className="mt-2 text-stone-600">
            {ageFrom(p.dateOfBirth)} yrs · {p.occupation} · {p.city}, {p.state}
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
              <h2 className="text-2xl text-maroon">Why you may match</h2>
              <p className="font-display text-3xl font-semibold text-maroon">{fit.score}<span className="text-base font-medium text-stone-500">% match</span></p>
            </div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <ul className="space-y-1.5">
                {fit.reasons.map((r) => <li key={r} className="flex gap-2 text-stone-700"><span className="text-emerald-600" aria-hidden>✓</span>{r}</li>)}
                {!fit.reasons.length && <li className="text-stone-500">Add partner preferences to see what you have in common.</li>}
              </ul>
              {fit.concerns.length > 0 && (
                <ul className="space-y-1.5">
                  {fit.concerns.map((c) => <li key={c} className="flex gap-2 text-stone-600"><span className="text-amber-600" aria-hidden>•</span>{c}</li>)}
                </ul>
              )}
            </div>
            <p className="mt-4 text-xs text-stone-500">Based on both members’ partner preferences, the gothram rule and star compatibility.</p>
          </section>
        )}
        {match && <PoruthamCard report={match} />}
        {!isSelf && !match && (
          <p className="rounded-xl border border-dashed border-hairline bg-white px-4 py-3 text-sm text-stone-600">
            Add your star and rasi to your profile to see star compatibility with members.
          </p>
        )}
        {p.about && <Card title="About"><p className="whitespace-pre-line text-sm text-stone-700">{p.about}</p></Card>}
        <Card title="Basic details">
          <Facts rows={[
            ["Profile created by", PROFILE_FOR_LABELS[p.profileFor]],
            ["Marital status", MARITAL_STATUS_LABELS[p.maritalStatus]],
            ["Height", heightLabel(p.heightCm)],
            ["Mother tongue", p.motherTongue],
            ["Sub-sect", p.subSect],
          ]} />
        </Card>
        <Card title="Lifestyle">
          <Facts rows={[["Diet", p.diet], ["Complexion", p.complexion], ["Languages", p.languages.join(", ")]]} />
        </Card>
        <Card title="Community & horoscope">
          <Facts rows={[
            ["Gothram", p.gothram],
            ["Kuladeivam", p.kuladeivam],
            ["Star", p.star],
            ["Rasi", p.rasi],
            ["Lagnam", p.lagnam],
            ["Dosham", DOSHAM_LABELS[p.dosham]],
            ["Place of birth", p.birthPlace],
            ["Time of birth", p.birthTime],
          ]} />
          {(p.rasi || p.lagnam || horoscope) && (
            <div className="mt-6 flex flex-wrap items-start gap-6 border-t border-hairline pt-6">
              <RasiChart rasi={p.rasi} lagnam={p.lagnam} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="eyebrow text-gold-dark">Horoscope</p>
                {horoscope && horoscopeAllowed ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`/api/horoscope/${p.id}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-maroon px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-maroon-dark">View horoscope</a>
                    <a href={`/api/horoscope/${p.id}?download=1`} className="rounded-full border border-gold/60 px-4 py-2 text-xs text-maroon hover:bg-gold-light/30">Download</a>
                  </div>
                ) : horoscope ? (
                  <p className="mt-2 text-stone-600">A horoscope is uploaded. It is shared once this member accepts your interest.</p>
                ) : (
                  <p className="mt-2 text-stone-500">No horoscope file uploaded yet.</p>
                )}
              </div>
            </div>
          )}
        </Card>
        <Card title="Education & career">
          <Facts rows={[["Education", p.education], ["Occupation", p.occupation], ["Annual income", p.annualIncome]]} />
        </Card>
        <Card title="Family">
          <Facts rows={[
            ["Father", [p.fatherName, p.fatherOccupation].filter(Boolean).join(" · ")],
            ["Mother", [p.motherName, p.motherOccupation].filter(Boolean).join(" · ")],
            ["Siblings", p.siblings],
            ["Family type", p.familyType],
            ["Family status", p.familyStatus],
            ["Native place", p.nativePlace],
          ]} />
        </Card>
        <Card title="Partner preferences">
          <Facts rows={[
            ["Age", p.prefAgeMin || p.prefAgeMax ? `${p.prefAgeMin ?? 18} – ${p.prefAgeMax ?? "any"} yrs` : null],
            ["Marital status", p.prefMaritalStatus.map((m) => MARITAL_STATUS_LABELS[m]).join(", ")],
            ["Stars", p.prefStars.join(", ")],
            ["Dosham", p.prefDosham === "NO" ? "Prefers no dosham" : p.prefDosham === "YES" ? "Prefers dosham" : null],
            ["Cities", p.prefCities.join(", ")],
            ["Education", p.prefEducation],
            ["Gothram", p.prefExcludeOwnGothram && p.gothram ? "Different gothram" : null],
            ["Other", p.prefNotes],
          ]} />
        </Card>
        {!isSelf && (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-2 text-sm text-stone-600">
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer hover:text-maroon">Report this profile</summary>
              <ActionForm action={reportProfile.bind(null, p.id)} className="mt-3 space-y-3">
                <SelectField label="Reason" name="category" options={REPORT_CATEGORY_LABELS} required placeholder="Choose a reason" />
                <TextArea label="Tell us what happened" name="reason" required minLength={10} maxLength={1000} />
                <SubmitButton variant="danger">Submit report</SubmitButton>
              </ActionForm>
            </details>
            <ActionForm action={blockFromForm.bind(null, p.id)} confirm="Block this member? You will no longer see each other, and any interest between you will be removed.">
              <button type="submit" className="hover:text-red-700">Block member</button>
            </ActionForm>
          </div>
        )}
      </div>
    </div>
  );
}
