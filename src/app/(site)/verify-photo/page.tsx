import Link from "next/link";
import { submitSelfie } from "@/app/actions/verification";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Verify your photos" };

export default async function VerifyPhotoPage() {
  const { profile } = await requireProfile();
  const [latest, approvedPhotos, enabled] = await Promise.all([
    db.idVerification.findFirst({
      where: { profileId: profile.id, docType: "SELFIE" },
      orderBy: { createdAt: "desc" },
      select: { status: true, rejectionReason: true, createdAt: true },
    }),
    db.photo.count({ where: { profileId: profile.id, approved: true } }),
    featureEnabled("photoVerification"),
  ]);
  const canSubmit = enabled && !profile.photoVerifiedAt && latest?.status !== "PENDING" && approvedPhotos > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Trust & safety"
        title="Verify your photos"
        subtitle="Take a quick selfie so families know your photos are really you."
      />

      {profile.photoVerifiedAt ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M5 12l4 4L19 7" /></svg>
              Photo verified
            </span>
            <p className="text-sm text-stone-700">
              Verified on {profile.photoVerifiedAt.toLocaleDateString("en-IN", { dateStyle: "long" })}. Your selfie has been deleted.
            </p>
          </div>
        </Card>
      ) : latest?.status === "PENDING" ? (
        <Card>
          <p className="text-sm text-stone-700">Your selfie is with our team for review. We’ll delete it as soon as it’s checked.</p>
        </Card>
      ) : latest?.status === "REJECTED" ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your last selfie was not accepted: {latest.rejectionReason}. Please try again.
        </p>
      ) : null}

      {!enabled && !profile.photoVerifiedAt && (
        <Card><p className="text-sm text-stone-700">Photo verification is paused at the moment. Please check back soon.</p></Card>
      )}

      {enabled && !profile.photoVerifiedAt && approvedPhotos === 0 && latest?.status !== "PENDING" && (
        <Card>
          <p className="text-sm text-stone-700">
            First add a clear photo of yourself and wait for it to be approved — we compare your selfie with it.{" "}
            <Link href="/photos" className="text-maroon underline decoration-gold/50 underline-offset-4">Add photos</Link>
          </p>
        </Card>
      )}

      {canSubmit && (
        <Card title="Take a selfie">
          <ActionForm action={submitSelfie} className="space-y-5">
            <ol className="grid gap-3 text-sm text-stone-700 sm:grid-cols-3">
              {["Face the camera in good light", "Remove sunglasses or a mask", "Only you in the photo"].map((tip, i) => (
                <li key={tip} className="flex items-center gap-3 rounded-xl bg-cream p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-xs font-semibold text-white">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ol>
            <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
              Selfie <span className="text-gold-dark">*</span>
              <input
                type="file"
                name="selfie"
                required
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="mt-1.5 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:text-maroon"
              />
              <span className="mt-1.5 block text-xs font-normal tracking-normal text-stone-500">On a phone this opens the front camera. JPEG, PNG or WebP, up to 5 MB.</span>
            </label>
            <div className="rounded-xl bg-cream p-4 text-xs leading-relaxed text-stone-600">
              <p className="font-medium text-ink">How we handle your selfie</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Encrypted as soon as it is uploaded and seen only by our verification team.</li>
                <li>Never shown to other members — they only see the “Photo verified” badge.</li>
                <li>Permanently deleted the moment it is reviewed.</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 text-sm text-stone-600">
              <input type="checkbox" name="consent" required className="mt-1 accent-maroon" />
              I consent to Devangar Matrimony comparing this selfie with my profile photos to verify them.
            </label>
            <SubmitButton>Submit selfie</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <p className="text-center text-sm text-stone-500">
        Also verify your identity: <Link href="/verify-id" className="text-maroon underline decoration-gold/50 underline-offset-4">verify your ID</Link>
      </p>
    </div>
  );
}
