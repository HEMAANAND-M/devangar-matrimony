import { redirect } from "next/navigation";
import { resendOtp, verifyOtp } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/fields";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Verify mobile" };

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.phoneVerified) redirect("/dashboard");
  return (
    <AuthShell eyebrow="Step 2 of 4" title="Verify your mobile" subtitle={`Enter the 6-digit code we sent to ${user.phone}.`}>
      <ActionForm action={verifyOtp} className="space-y-5">
        <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
          One-time password
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
        <SubmitButton className="w-full py-3.5">Verify</SubmitButton>
      </ActionForm>
      <ActionForm action={resendOtp} className="mt-8 flex items-center justify-center gap-3 border-t border-hairline pt-6 text-sm text-stone-600">
        <span>Didn’t receive it?</span>
        <SubmitButton variant="secondary" className="!px-4 !py-1.5">Resend code</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
