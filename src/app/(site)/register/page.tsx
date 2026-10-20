import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getCurrentUser, homePath } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Register" };

const STEPS = ["Account", "Verify OTP", "Profile", "Photos"];

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ phone?: string; ref?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user, !!user.profile));
  const params = await searchParams;
  // Prefilled from the home page quick-start form; digits only.
  const phone = params.phone?.replace(/\D/g, "").slice(-10);
  // Referral code from a member's share link (/register?ref=CODE).
  const ref = params.ref?.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  if (!(await featureEnabled("registrations"))) {
    return (
      <AuthShell eyebrow="Join" title="Registrations are paused" subtitle="We are not accepting new registrations for a short while. Please check back soon.">
        <p className="text-sm text-stone-600">
          Already a member? <Link href="/login" className={authLinkCls}>Log in</Link>
        </p>
      </AuthShell>
    );
  }
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
        {ref && <input type="hidden" name="ref" value={ref} />}
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" defaultValue={phone} hint="Indian mobile number. We'll send an OTP to verify it." />
        <TextField label="Password" name="password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters with a letter and a number" autoFocus={Boolean(phone)} />
        <TextField label="Confirm password" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        <label className="flex items-start gap-3 rounded-lg bg-cream/70 p-3.5 text-sm leading-relaxed text-stone-600">
          <input type="checkbox" name="terms" required className="mt-1 accent-maroon" />
          I confirm the profile is for a member of the Devangar community and I agree to the terms and privacy policy.
        </label>
        <label className="flex items-start gap-3 px-3.5 text-sm leading-relaxed text-stone-600">
          <input type="checkbox" name="whatsapp" className="mt-1 accent-maroon" />
          Send me updates on WhatsApp — new interests, acceptances and weekly matches. You can turn this off any time.
        </label>
        <SubmitButton className="w-full py-3.5">Register &amp; send OTP</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        Already registered? <Link href="/login" className={authLinkCls}>Log in</Link>
      </p>
    </AuthShell>
  );
}
