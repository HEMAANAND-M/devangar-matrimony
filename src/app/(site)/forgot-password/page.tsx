import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getT } from "@/lib/i18n";
import { Turnstile } from "@/components/Turnstile";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const { locked } = await searchParams;
  const t = await getT();
  const siteKey = turnstileSiteKey();
  return (
    <AuthShell eyebrow={t("auth.recoveryEyebrow")} title={t("auth.forgotTitle")} subtitle={t("auth.forgotLead")}>
      {locked === "1" && (
        <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-800">{t("auth.lockedNotice")}</p>
      )}
      <ActionForm action={requestPasswordReset} className="space-y-5">
        <TextField label={t("auth.mobile")} name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" />
        {siteKey && <Turnstile siteKey={siteKey} />}
        <SubmitButton className="w-full py-3.5">{t("auth.sendCode")}</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        {t("auth.remembered")} <Link href="/login" className={authLinkCls}>{t("auth.loginButton")}</Link>
      </p>
    </AuthShell>
  );
}
