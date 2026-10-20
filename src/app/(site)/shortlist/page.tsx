import Link from "next/link";
import { PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { connectedIds } from "@/lib/access";
import { db } from "@/lib/db";
import { withCard } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Shortlist" };

export default async function ShortlistPage() {
  const { profile } = await requireProfile();
  const [items, connected] = await Promise.all([
    db.shortlist.findMany({
      where: { ownerId: profile.id, target: { status: "APPROVED" } },
      include: { target: { include: withCard } },
      orderBy: { createdAt: "desc" },
    }),
    connectedIds(profile.id),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Saved profiles" title="Shortlist" subtitle="Profiles you are considering, in one place." />
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {items.map(({ target }) => <ProfileCard key={target.id} profile={target} photo={cardPhoto(target, connected)} viewer={profile} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gold/40 bg-white px-6 py-12 text-center">
          <p className="font-display text-2xl text-maroon">Your shortlist is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            Use “Add to shortlist” on any profile to keep it here while your family discusses it. Only you can see your shortlist.
          </p>
          <Link href="/search" className="mt-5 inline-block rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">Find profiles</Link>
        </div>
      )}
    </div>
  );
}
