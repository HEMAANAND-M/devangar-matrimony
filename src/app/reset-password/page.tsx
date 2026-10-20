import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField, inputCls } from "@/components/fields";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const phone = (await searchParams).phone?.replace(/\D/g, "").slice(-10);
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Set a new password"
      subtitle="If that number is registered, we've sent a 6-digit code. It expires in 10 minutes."
    >
      <ActionForm action={resetPassword} className="space-y-5">
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" required autoComplete="tel" defaultValue={phone} />
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
        <TextField label="New password" name="password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
        <TextField label="Confirm new password" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        <SubmitButton className="w-full py-3.5">Reset password</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        Didn’t get a code? <Link href="/forgot-password" className={authLinkCls}>Send again</Link>
      </p>
    </AuthShell>
  );
}
