import { PageHeader } from "@/components/Card";
import { ProfileCard, cardPhoto } from "@/components/ProfileCard";
import { connectedIds } from "@/lib/access";
import { db } from "@/lib/db";
import { withPhotos } from "@/lib/queries";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Shortlist" };

export default async function ShortlistPage() {
  const { profile } = await requireProfile();
  const [items, connected] = await Promise.all([
    db.shortlist.findMany({
      where: { ownerId: profile.id, target: { status: "APPROVED" } },
      include: { target: { include: withPhotos } },
      orderBy: { createdAt: "desc" },
    }),
    connectedIds(profile.id),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Saved profiles" title="Shortlist" subtitle="Profiles you are considering, in one place." />
      {items.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map(({ target }) => <ProfileCard key={target.id} profile={target} photo={cardPhoto(target, connected)} />)}
        </div>
      ) : (
        <p className="text-stone-600">Profiles you shortlist will appear here.</p>
      )}
    </div>
  );
}
