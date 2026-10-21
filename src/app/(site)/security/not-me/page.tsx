import Link from "next/link";
import { revokeFromLink } from "@/app/actions/security";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { readRevokeToken } from "@/lib/revoke-token";

export const metadata = { title: "Secure your account", robots: { index: false } };

export default async function NotMePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t: token = "" } = await searchParams;
  const t = await getT();
  const claim = token ? await readRevokeToken(token) : null;
  const valid = claim && (await db.user.findFirst({ where: { id: claim.userId, sessionVersion: claim.version }, select: { id: true } }));

  return (
    <AuthShell eyebrow={t("notMe.eyebrow")} title={t("notMe.title")} subtitle={valid ? t("notMe.lead") : t("notMe.expired")}>
      {valid ? (
        <ActionForm action={revokeFromLink.bind(null, token)} className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-700">
            <li>{t("notMe.step1")}</li>
            <li>{t("notMe.step2")}</li>
            <li>{t("notMe.step3")}</li>
          </ul>
          <SubmitButton className="w-full py-3.5">{t("notMe.button")}</SubmitButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-stone-600">
          <Link href="/forgot-password" className="text-maroon underline decoration-gold/50 underline-offset-4">{t("notMe.reset")}</Link>
        </p>
      )}
    </AuthShell>
  );
}
