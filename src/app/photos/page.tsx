import Link from "next/link";
import { deletePhoto, makePrimaryPhoto, uploadPhoto } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card } from "@/components/Card";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/format";
import { MAX_PHOTOS } from "@/lib/photos";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "My photos" };

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { profile } = await requireProfile();
  const { welcome } = await searchParams;
  const photos = await db.photo.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {welcome && (
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Profile created! It will be visible to others once our team approves it. Profiles with photos get far
          more responses. <Link href="/dashboard" className="underline">Skip for now</Link>
        </p>
      )}
      <Card title={`My photos (${photos.length}/${MAX_PHOTOS})`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((ph) => (
            <div key={ph.id} className="overflow-hidden rounded-md border border-hairline">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
              <img src={photoUrl(ph.id, "thumb")} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
              <div className="space-y-2 p-2 text-xs">
                <p>
                  {ph.isPrimary && <span className="mr-1 rounded bg-maroon px-1.5 py-0.5 text-white">Primary</span>}
                  {ph.approved ? <span className="text-green-700">Approved</span> : <span className="text-amber-700">Awaiting review</span>}
                </p>
                <div className="flex gap-2">
                  {!ph.isPrimary && (
                    <form action={makePrimaryPhoto.bind(null, ph.id)}>
                      <button className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Make primary</button>
                    </form>
                  )}
                  <form action={deletePhoto.bind(null, ph.id)}>
                    <button className="text-red-700 underline">Delete</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS && (
          <ActionForm action={uploadPhoto} className="mt-6 flex flex-wrap items-center gap-3">
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
            <SubmitButton>Upload</SubmitButton>
            <p className="w-full text-xs text-stone-500">JPEG, PNG or WebP, up to 5 MB. Clear, recent photos of the member only.</p>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
