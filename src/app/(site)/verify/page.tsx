import { redirect } from "next/navigation";
import { resendOtp, startOver, verifyOtp } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/fields";
import { ResendCodeButton } from "@/components/ResendCodeButton";
import { maskPhone } from "@/lib/format";
import { resendWaitSeconds } from "@/lib/otp";
import { getT } from "@/lib/i18n";
import { getCurrentUser, homePath } from "@/lib/session";

export const metadata = { title: "Verify mobile" };

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.phoneVerified) redirect(homePath(user, !!user.profile));
  const [wait, t] = await Promise.all([resendWaitSeconds(user.id), getT()]);
  return (
    <AuthShell eyebrow={t("auth.verifyEyebrow")} title={t("auth.verifyTitle")} subtitle={t("auth.verifyLead", { phone: maskPhone(user.phone) })}>
      <ActionForm action={verifyOtp} className="space-y-5">
        <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
          {t("auth.otp")}
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            autoComplete="one-time-code"
            placeholder="••••••"
            className={`${inputCls} text-center font-display text-3xl tracking-[0.6em]`}
          />
        </label>
        <SubmitButton className="w-full py-3.5">{t("auth.verifyButton")}</SubmitButton>
      </ActionForm>
      <div className="mt-8 space-y-4 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        <p>{t("auth.notReceived")}</p>
        <ResendCodeButton action={resendOtp} initialWait={wait} labels={{ resend: t("auth.resend"), resendIn: t("auth.resendIn", { seconds: "{seconds}" }), sending: t("auth.sending") }} />
        <ActionForm action={startOver} className="flex flex-wrap items-center justify-center gap-2">
          <span>{t("auth.wrongNumber")}</span>
          <button className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t("auth.startAgain")}</button>
        </ActionForm>
      </div>
    </AuthShell>
  );
}
