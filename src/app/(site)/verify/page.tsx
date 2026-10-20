import { redirect } from "next/navigation";
import { resendOtp, startOver, verifyOtp } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/fields";
import { ResendCodeButton } from "@/components/ResendCodeButton";
import { maskPhone } from "@/lib/format";
import { resendWaitSeconds } from "@/lib/otp";
import { getCurrentUser, homePath } from "@/lib/session";

export const metadata = { title: "Verify mobile" };

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.phoneVerified) redirect(homePath(user, !!user.profile));
  const wait = await resendWaitSeconds(user.id);
  return (
    <AuthShell eyebrow="Step 2 of 4" title="Verify your mobile" subtitle={`Enter the 6-digit code we sent by SMS to ${maskPhone(user.phone)}.`}>
      <ActionForm action={verifyOtp} className="space-y-5">
        <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
          One-time password
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
        <SubmitButton className="w-full py-3.5">Verify</SubmitButton>
      </ActionForm>
      <div className="mt-8 space-y-4 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        <p>Didn’t receive it? Codes can take up to a minute to arrive.</p>
        <ResendCodeButton action={resendOtp} initialWait={wait} />
        <ActionForm action={startOver} className="flex flex-wrap items-center justify-center gap-2">
          <span>Wrong number?</span>
          <button className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Start again</button>
        </ActionForm>
      </div>
    </AuthShell>
  );
}
