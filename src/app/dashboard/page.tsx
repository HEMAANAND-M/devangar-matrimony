import Link from "next/link";
import { setProfileHidden } from "@/app/actions/profile";
import { Card, PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { connectedIds } from "@/lib/access";
import { db } from "@/lib/db";
import { dobRangeForAges } from "@/lib/format";
import { browsableWhere, withPhotos } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Dashboard" };

const STATUS_TEXT = {
  PENDING: ["Under review", "Our team is reviewing your profile. This usually takes less than a day."],
  APPROVED: ["Live", "Your profile is visible to members."],
  REJECTED: ["Needs changes", "Please update your profile — see the note on the profile page."],
  HIDDEN: ["Hidden", "Your profile is hidden from search. Unhide it any time."],
} as const;

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  const [received, accepted, photoCount, connected] = await Promise.all([
    db.interest.count({ where: { toId: profile.id, status: "PENDING" } }),
    db.interest.count({ where: { status: "ACCEPTED", OR: [{ fromId: profile.id }, { toId: profile.id }] } }),
    db.photo.count({ where: { profileId: profile.id } }),
    connectedIds(profile.id),
  ]);

  const ageFilter =
    profile.prefAgeMin || profile.prefAgeMax
      ? { dateOfBirth: dobRangeForAges(profile.prefAgeMin ?? 18, profile.prefAgeMax ?? 80) }
      : {};
  const matches = await db.profile.findMany({
    where: {
      ...browsableWhere(profile),
      ...ageFilter,
      ...(profile.prefMaritalStatus.length ? { maritalStatus: { in: profile.prefMaritalStatus } } : {}),
      receivedInterests: { none: { fromId: profile.id } },
    },
    include: withPhotos,
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const [statusLabel, statusText] = STATUS_TEXT[profile.status];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Profile ${profile.code}`} title={`Welcome, ${profile.name.split(" ")[0]}`} subtitle="Here is what is happening with your search today." />
      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <p className="eyebrow text-gold-dark">Profile status</p>
          <p className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold text-maroon">
            <span className={`h-2.5 w-2.5 rounded-full ${profile.status === "APPROVED" ? "bg-emerald-600" : profile.status === "REJECTED" ? "bg-red-600" : "bg-amber-500"}`} aria-hidden />
            {statusLabel}
          </p>
          <p className="mt-1 text-sm text-stone-600">{statusText}</p>
          {(profile.status === "APPROVED" || profile.status === "HIDDEN") && (
            <form action={setProfileHidden.bind(null, profile.status === "APPROVED")} className="mt-2">
              <button className="text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{profile.status === "APPROVED" ? "Hide my profile" : "Unhide my profile"}</button>
            </form>
          )}
        </Card>
        <Card>
          <p className="eyebrow text-gold-dark">Interests</p>
          <p className="mt-2 font-display text-3xl font-semibold text-maroon">{received} <span className="text-lg font-medium text-stone-600">awaiting reply</span></p>
          <p className="mt-1 text-sm text-stone-600">{accepted} accepted connections</p>
          <Link href="/interests" className="mt-2 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">View interests</Link>
        </Card>
        <Card>
          <p className="eyebrow text-gold-dark">Photos</p>
          <p className="mt-2 font-display text-3xl font-semibold text-maroon">{photoCount} <span className="text-lg font-medium text-stone-600">uploaded</span></p>
          <Link href="/photos" className="mt-2 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            {photoCount ? "Manage photos" : "Add a photo"}
          </Link>
        </Card>
      </div>

      <div className="flex items-end justify-between pt-6">
        <div>
          <p className="eyebrow text-gold-dark">Curated for you</p>
          <h2 className="mt-1 text-3xl text-maroon">Matches for you</h2>
        </div>
        <Link href="/search" className="text-sm text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Search all</Link>
      </div>
      {matches.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {matches.map((m) => <ProfileCard key={m.id} profile={m} photo={cardPhoto(m, connected)} />)}
        </div>
      ) : (
        <p className="text-stone-600">No new matches for your preferences yet. Try widening them or use Search.</p>
      )}
    </div>
  );
}
