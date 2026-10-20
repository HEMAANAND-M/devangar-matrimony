import { notFound } from "next/navigation";
import { after } from "next/server";
import { blockFromForm, reportProfile, sendInterest, toggleShortlist } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card } from "@/components/Card";
import { PoruthamCard } from "@/components/PoruthamCard";
import { TextArea } from "@/components/fields";
import { isBlocked, isConnected, visiblePhotos } from "@/lib/access";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, PROFILE_FOR_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ageFrom, heightLabel, photoUrl } from "@/lib/format";
import { porutham } from "@/lib/porutham";
import { withPhotos } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  if (!rows.some(([, v]) => v)) return <p className="text-sm italic text-stone-400">Not added yet</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-36 shrink-0 text-stone-500">{k}</dt>
          <dd className="text-stone-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  // The ID only: member names stay out of browser history and tab titles.
  return { title: `Profile ${(await params).code}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user, profile: me } = await requireProfile();
  const isAdmin = user.role === "ADMIN";

  const p = await db.profile.findUnique({ where: { code }, include: { ...withPhotos, user: { select: { phone: true } } } });
  const isSelf = p?.id === me.id;
  if (!p || (!isSelf && !isAdmin && (p.status !== "APPROVED" || p.gender === me.gender))) notFound();
  if (!isSelf && !isAdmin && (await isBlocked(me.id, p.id))) notFound();

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

  const [connected, sent, received, shortlisted] = await Promise.all([
    isConnected(me.id, p.id),
    db.interest.findUnique({ where: { fromId_toId: { fromId: me.id, toId: p.id } } }),
    db.interest.findUnique({ where: { fromId_toId: { fromId: p.id, toId: me.id } } }),
    db.shortlist.findUnique({ where: { ownerId_targetId: { ownerId: me.id, targetId: p.id } } }),
  ]);
  const photos = visiblePhotos(p, { profileId: me.id, isAdmin }, connected);
  const hiddenPhotos = !photos.length && p.photos.some((ph) => ph.approved) && p.photoVisibility === "ACCEPTED_ONLY";
  const match = isSelf ? null : me.gender === "FEMALE" ? porutham(me, p) : porutham(p, me);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
          {photos.length ? (
            <div className="grid gap-1">
              {photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
                <img key={ph.id} src={photoUrl(ph.id)} alt={p.name} decoding="async" className="w-full object-cover" />
              ))}
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
                <p className="mt-1">Contact: <a href={`tel:${p.user.phone}`} className="font-medium text-maroon">{p.user.phone}</a></p>
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
        </div>
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
        <Card title="Community & horoscope">
          <Facts rows={[
            ["Gothram", p.gothram],
            ["Kuladeivam", p.kuladeivam],
            ["Star", p.star],
            ["Rasi", p.rasi],
            ["Dosham", DOSHAM_LABELS[p.dosham]],
            ["Place of birth", p.birthPlace],
            ["Time of birth", p.birthTime],
          ]} />
        </Card>
        <Card title="Education & career">
          <Facts rows={[["Education", p.education], ["Occupation", p.occupation], ["Annual income", p.annualIncome]]} />
        </Card>
        <Card title="Family">
          <Facts rows={[["Father", p.fatherOccupation], ["Mother", p.motherOccupation], ["Siblings", p.siblings]]} />
        </Card>
        <Card title="Partner preferences">
          <Facts rows={[
            ["Age", p.prefAgeMin || p.prefAgeMax ? `${p.prefAgeMin ?? 18} – ${p.prefAgeMax ?? "any"} yrs` : null],
            ["Marital status", p.prefMaritalStatus.map((m) => MARITAL_STATUS_LABELS[m]).join(", ")],
            ["Other", p.prefNotes],
          ]} />
        </Card>
        {!isSelf && (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-2 text-sm text-stone-600">
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer hover:text-maroon">Report this profile</summary>
              <ActionForm action={reportProfile.bind(null, p.id)} className="mt-3 space-y-3">
                <TextArea label="What is wrong with this profile?" name="reason" required minLength={10} maxLength={1000} />
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
