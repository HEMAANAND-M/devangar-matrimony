import Link from "next/link";
import { submitIdVerification } from "@/app/actions/verification";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { IdVerifiedBadge } from "@/components/Badges";
import { Card, PageHeader } from "@/components/Card";
import { SelectField, TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Verify your ID" };

const DOC_LABELS: Record<string, string> = {
  AADHAAR: "Aadhaar (masked copy)",
  PAN: "PAN card",
  PASSPORT: "Passport",
  VOTER_ID: "Voter ID",
  DRIVING_LICENCE: "Driving licence",
};

export default async function VerifyIdPage() {
  const { profile } = await requireProfile();
  const enabled = await featureEnabled("idVerification");
  const latest = await db.idVerification.findFirst({
    where: { profileId: profile.id, docType: { not: "SELFIE" } },
    orderBy: { createdAt: "desc" },
    select: { status: true, docType: true, last4: true, rejectionReason: true, createdAt: true },
  });
  const canSubmit = enabled && !profile.idVerifiedAt && latest?.status !== "PENDING";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Trust & safety"
        title="Verify your ID"
        subtitle="Members with a verified ID receive more responses — families trust them more."
      />

      {profile.idVerifiedAt ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <IdVerifiedBadge />
            <p className="text-sm text-stone-700">
              Verified on {profile.idVerifiedAt.toLocaleDateString("en-IN", { dateStyle: "long" })}. Your document has been deleted.
            </p>
          </div>
        </Card>
      ) : latest?.status === "PENDING" ? (
        <Card>
          <p className="text-sm text-stone-700">
            Your {DOC_LABELS[latest.docType]} ending <strong>••{latest.last4}</strong> is awaiting review. We’ll delete the document as soon as it’s checked.
          </p>
        </Card>
      ) : latest?.status === "REJECTED" ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your last submission was not accepted: {latest.rejectionReason}. Please upload a clearer copy.
        </p>
      ) : null}

      {!enabled && !profile.idVerifiedAt && (
        <Card><p className="text-sm text-stone-700">ID verification is paused at the moment. Please check back soon.</p></Card>
      )}

      {canSubmit && (
        <Card title="Upload a government ID">
          <ActionForm action={submitIdVerification} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Document type" name="docType" options={DOC_LABELS} required />
              <TextField
                label="Last 4 characters of the number"
                name="last4"
                required
                maxLength={4}
                pattern="[A-Za-z0-9]{4}"
                autoComplete="off"
                hint="We never ask for or store the full number."
              />
            </div>
            <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
              Document photo or PDF <span className="text-gold-dark">*</span>
              <input
                type="file"
                name="document"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1.5 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:text-maroon"
              />
              <span className="mt-1.5 block text-xs font-normal tracking-normal text-stone-500">JPEG, PNG, WebP or PDF, up to 5 MB.</span>
            </label>
            <div className="rounded-xl bg-cream p-4 text-xs leading-relaxed text-stone-600">
              <p className="font-medium text-ink">For Aadhaar, upload a <em>masked</em> Aadhaar</p>
              <p className="mt-1">
                Download it from the official UIDAI website (myaadhaar.uidai.gov.in → Download Aadhaar → “masked Aadhaar”). It
                shows only the last 4 digits. Do not upload a full Aadhaar.
              </p>
              <p className="mt-3 font-medium text-ink">How we handle your document</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Encrypted as soon as it is uploaded and visible only to our verification team.</li>
                <li>Permanently deleted the moment it is reviewed, or after 30 days if not reviewed.</li>
                <li>Never shown to other members — they only see the “ID verified” badge.</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 text-sm text-stone-600">
              <input type="checkbox" name="consent" required className="mt-1 accent-maroon" />
              I consent to Devangar Matrimony using this document only to verify the identity of this profile.
            </label>
            <SubmitButton>Submit for verification</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-ink">Verify your photos too</p>
            <p className="text-sm text-stone-600">A quick selfie adds the “Photo verified” badge to your profile.</p>
          </div>
          <Link href="/verify-photo" className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-maroon transition hover:border-gold hover:bg-gold-light/30">
            {profile.photoVerifiedAt ? "Photos verified ✓" : "Verify photos"}
          </Link>
        </div>
      </Card>
    </div>
  );
}
