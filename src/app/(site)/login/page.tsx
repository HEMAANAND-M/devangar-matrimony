import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getT } from "@/lib/i18n";
import { getCurrentUser, homePath } from "@/lib/session";
import { Turnstile } from "@/components/Turnstile";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user, !!user.profile));
  const t = await getT();
  const siteKey = turnstileSiteKey();
  return (
    <AuthShell eyebrow={t("auth.loginEyebrow")} title={t("auth.loginTitle")} subtitle={t("auth.loginLead")}>
      <ActionForm action={login} className="space-y-5">
        <TextField label={t("auth.mobile")} name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" />
        <TextField label={t("auth.password")} name="password" type="password" required autoComplete="current-password" />
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-stone-600 hover:text-maroon">{t("auth.forgot")}</Link>
        </p>
        {siteKey && <Turnstile siteKey={siteKey} />}
        <SubmitButton className="w-full py-3.5">{t("auth.loginButton")}</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        {t("auth.newHere")} <Link href="/register" className={authLinkCls}>{t("auth.registerFree")}</Link>
      </p>
      <p className="mt-3 text-center text-xs text-stone-500">
        {t("auth.trouble")} <Link href="/support" className="underline decoration-gold/50 underline-offset-4 hover:text-maroon">{t("auth.contactSupport")}</Link>
      </p>
    </AuthShell>
  );
}
