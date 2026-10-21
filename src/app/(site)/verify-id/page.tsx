import Link from "next/link";
import { submitIdVerification } from "@/app/actions/verification";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { IdVerifiedBadge } from "@/components/Badges";
import { Card, PageHeader } from "@/components/Card";
import { SelectField, TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";
import { type TKey, getLocale, getT } from "@/lib/i18n";

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
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const docLabels = Object.fromEntries(Object.keys(DOC_LABELS).map((k) => [k, t(`vid.doc.${k}` as TKey)]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("vid.eyebrow")}
        title={t("vid.title")}
        subtitle={t("vid.subtitle")}
      />

      {profile.idVerifiedAt ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <IdVerifiedBadge />
            <p className="text-sm text-stone-700">
              {t("vid.verifiedOn", { date: profile.idVerifiedAt.toLocaleDateString("en-IN", { dateStyle: "long" }) })}
            </p>
          </div>
        </Card>
      ) : latest?.status === "PENDING" ? (
        <Card>
          <p className="text-sm text-stone-700">
            {t("vid.pendingA", { doc: docLabels[latest.docType] })} <strong>••{latest.last4}</strong> {t("vid.pendingB")}
          </p>
        </Card>
      ) : latest?.status === "REJECTED" ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {t("vid.rejected", { reason: latest.rejectionReason ?? "" })}
        </p>
      ) : null}

      {!enabled && !profile.idVerifiedAt && (
        <Card><p className="text-sm text-stone-700">{t("vid.paused")}</p></Card>
      )}

      {canSubmit && (
        <Card title={t("vid.uploadTitle")}>
          <ActionForm action={submitIdVerification} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t("vid.docType")} name="docType" options={docLabels} required />
              <TextField
                label={t("vid.last4")}
                name="last4"
                required
                maxLength={4}
                pattern="[A-Za-z0-9]{4}"
                autoComplete="off"
                hint={t("vid.last4Hint")}
              />
            </div>
            <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
              {t("vid.file")} <span className="text-gold-dark">*</span>
              <input
                type="file"
                name="document"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1.5 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:text-maroon"
              />
              <span className="mt-1.5 block text-xs font-normal tracking-normal text-stone-500">{t("vid.fileHint")}</span>
            </label>
            <div className="rounded-xl bg-cream p-4 text-xs leading-relaxed text-stone-600">
              {locale === "ta" ? (
                <p className="font-medium text-ink">{t("vid.aadhaarTitle")}</p>
              ) : (
                <p className="font-medium text-ink">For Aadhaar, upload a <em>masked</em> Aadhaar</p>
              )}
              <p className="mt-1">{t("vid.aadhaarBody")}</p>
              <p className="mt-3 font-medium text-ink">{t("vid.howTitle")}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>{t("vid.how1")}</li>
                <li>{t("vid.how2")}</li>
                <li>{t("vid.how3")}</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 text-sm text-stone-600">
              <input type="checkbox" name="consent" required className="mt-1 accent-maroon" />
              {t("vid.consent")}
            </label>
            <SubmitButton>{t("vid.submit")}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-ink">{t("vid.photosToo")}</p>
            <p className="text-sm text-stone-600">{t("vid.photosTooBody")}</p>
          </div>
          <Link href="/verify-photo" className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-maroon transition hover:border-gold hover:bg-gold-light/30">
            {t(profile.photoVerifiedAt ? "vid.photosVerified" : "vid.verifyPhotos")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
