import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Forgot password?" subtitle="We'll send a one-time code to your registered mobile number.">
      <ActionForm action={requestPasswordReset} className="space-y-5">
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" />
        <SubmitButton className="w-full py-3.5">Send code</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        Remembered it? <Link href="/login" className={authLinkCls}>Log in</Link>
      </p>
    </AuthShell>
  );
}
