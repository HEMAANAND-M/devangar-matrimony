import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Register" };

const STEPS = ["Account", "Verify OTP", "Profile", "Photos"];

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  // Prefilled from the home page quick-start form; digits only.
  const phone = (await searchParams).phone?.replace(/\D/g, "").slice(-10);
  return (
    <AuthShell eyebrow="Join free" title="Create your account" subtitle="Four short steps to a verified, live profile.">
      <ol className="mb-8 flex items-center text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <span className={`flex items-center gap-2 ${i === 0 ? "font-semibold text-maroon" : "text-stone-400"}`}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-sm ${
                  i === 0 ? "bg-maroon text-gold-light shadow-soft" : "border border-hairline bg-cream"
                }`}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-hairline" aria-hidden />}
          </li>
        ))}
      </ol>
      <ActionForm action={register} className="space-y-5">
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" defaultValue={phone} hint="Indian mobile number. We'll send an OTP to verify it." />
        <TextField label="Password" name="password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters" autoFocus={Boolean(phone)} />
        <TextField label="Confirm password" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        <label className="flex items-start gap-3 rounded-lg bg-cream/70 p-3.5 text-sm leading-relaxed text-stone-600">
          <input type="checkbox" name="terms" required className="mt-1 accent-maroon" />
          I confirm the profile is for a member of the Devangar community and I agree to the terms and privacy policy.
        </label>
        <SubmitButton className="w-full py-3.5">Register &amp; send OTP</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        Already registered? <Link href="/login" className={authLinkCls}>Log in</Link>
      </p>
    </AuthShell>
  );
}
