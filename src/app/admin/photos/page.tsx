import Link from "next/link";
import { approvePhoto, approvePhotos, rejectPhoto } from "@/app/actions/admin";
import { ApproveButton, BulkAction, RejectForm, SelectAll } from "@/app/admin/approvals/_components/moderation";
import { PHOTO_REJECT_REASONS, waited } from "@/app/admin/approvals/_components/shared";
import { AdminPageHeader, Badge, EmptyState, Panel, statusTone, label } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { ensurePhotoHashes, findDuplicatePhotos } from "@/lib/flags";
import { requireStaff } from "@/lib/session";
import { signedPhotoUrl } from "@/lib/photo-url";

export const metadata = { title: "Photo review" };

const PAGE = 60;

export default async function PhotosPage() {
  await requireStaff();
  await ensurePhotoHashes(PAGE);
  const [photos, total] = await Promise.all([
    db.photo.findMany({
      where: { approved: false },
      select: {
        id: true, isPrimary: true, createdAt: true,
        profile: { select: { id: true, code: true, name: true, status: true, userId: true, _count: { select: { photos: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: PAGE,
    }),
    db.photo.count({ where: { approved: false } }),
  ]);
  const dupes = await findDuplicatePhotos(photos.map((p) => p.id));

  return (
    <div>
      <AdminPageHeader
        title="Photos"
        description={
          total ? (
            <>
              {total} waiting{total > PAGE && ` (showing the oldest ${PAGE})`} · oldest has waited <strong className="text-ink">{waited(photos[0].createdAt)}</strong>
              {dupes.size > 0 && <> · <span className="text-red-700">{dupes.size} possible duplicate{dupes.size === 1 ? "" : "s"}</span></>}
            </>
          ) : (
            "Members' photos are hidden from others until approved here."
          )
        }
      />
      <Panel
        flush
        title={
          photos.length ? (
            <span className="flex items-center gap-3">
              <SelectAll formId="photo-grid" /> Select all
            </span>
          ) : (
            "Waiting for review"
          )
        }
        description={photos.length ? "Rejected photos are deleted and the member is told why." : undefined}
        actions={photos.length ? <BulkAction formId="photo-grid" action={approvePhotos} label="Approve selected" /> : null}
      >
        {photos.length ? (
          <form id="photo-grid" className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {photos.map((ph) => {
              const dupe = dupes.get(ph.id);
              return (
                <article key={ph.id} className={`overflow-hidden rounded-xl border bg-white ${dupe ? "border-red-300 ring-2 ring-red-100" : "border-hairline"}`}>
                  <div className="relative">
                    <a href={signedPhotoUrl(ph.id)} target="_blank" rel="noopener noreferrer" title="Open full size">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
                      <img src={signedPhotoUrl(ph.id)} alt={`Photo uploaded by ${ph.profile.code}`} loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-sand object-cover" />
                    </a>
                    <label className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-xs shadow">
                      <input type="checkbox" name="ids" value={ph.id} className="h-4 w-4 accent-maroon" /> Select
                    </label>
                    {ph.isPrimary && <span className="absolute right-2 top-2"><Badge tone="gold">Primary</Badge></span>}
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/admin/approvals?id=${ph.profile.id}`} className="block truncate font-medium text-ink hover:text-maroon">{ph.profile.name}</Link>
                        <p className="text-xs text-stone-500">{ph.profile.code} · {ph.profile._count.photos} photo{ph.profile._count.photos === 1 ? "" : "s"} · {waited(ph.createdAt)} ago</p>
                      </div>
                      <Badge tone={statusTone(ph.profile.status)}>{label(ph.profile.status)}</Badge>
                    </div>
                    {dupe && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
                        <img src={signedPhotoUrl(dupe.photoId, "thumb")} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                        <span>
                          Looks like a photo on <Link href={`/profiles/${dupe.profileCode}`} target="_blank" className="font-medium underline">{dupe.profileName} ({dupe.profileCode})</Link>
                          {dupe.distance === 0 ? " — identical." : " — very similar."}
                        </span>
                      </div>
                    )}
                    <ApproveButton action={approvePhoto.bind(null, ph.id)} className="w-full" />
                    <RejectForm action={rejectPhoto.bind(null, ph.id)} reasons={PHOTO_REJECT_REASONS} compact />
                  </div>
                </article>
              );
            })}
          </form>
        ) : (
          <EmptyState title="All caught up">No photos are waiting for review.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
