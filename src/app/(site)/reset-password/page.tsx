import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField, inputCls } from "@/components/fields";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const phone = (await searchParams).phone?.replace(/\D/g, "").slice(-10);
  const t = await getT();
  return (
    <AuthShell
      eyebrow={t("auth.recoveryEyebrow")}
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetLead")}
    >
      <ActionForm action={resetPassword} className="space-y-5">
        <TextField label={t("auth.mobile")} name="phone" type="tel" inputMode="numeric" required autoComplete="tel" defaultValue={phone} />
        <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
          {t("auth.otp")}
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            required
            autoComplete="one-time-code"
            placeholder="••••••"
            className={`${inputCls} text-center font-display text-3xl tracking-[0.6em]`}
          />
        </label>
        <TextField label={t("auth.newPassword")} name="password" type="password" minLength={8} required autoComplete="new-password" hint={t("auth.passwordHint")} />
        <TextField label={t("auth.confirmNewPassword")} name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        <SubmitButton className="w-full py-3.5">{t("auth.resetButton")}</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        {t("auth.noCode")} <Link href="/forgot-password" className={authLinkCls}>{t("auth.sendAgain")}</Link>
      </p>
    </AuthShell>
  );
}
