import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getT } from "@/lib/i18n";
import { getCurrentUser, homePath } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Register" };

const STEPS = ["auth.stepAccount", "auth.stepOtp", "auth.stepProfile", "auth.stepPhotos"] as const;

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ phone?: string; ref?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user, !!user.profile));
  const params = await searchParams;
  const t = await getT();
  // Prefilled from the home page quick-start form; digits only.
  const phone = params.phone?.replace(/\D/g, "").slice(-10);
  // Referral code from a member's share link (/register?ref=CODE).
  const ref = params.ref?.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  if (!(await featureEnabled("registrations"))) {
    return (
      <AuthShell eyebrow={t("auth.joinEyebrow")} title={t("auth.pausedTitle")} subtitle={t("auth.pausedLead")}>
        <p className="text-sm text-stone-600">
          {t("auth.alreadyMember")} <Link href="/login" className={authLinkCls}>{t("auth.loginButton")}</Link>
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell eyebrow={t("auth.joinFree")} title={t("auth.registerTitle")} subtitle={t("auth.registerLead")}>
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
              <span className="hidden sm:inline">{t(s)}</span>
            </span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-hairline" aria-hidden />}
          </li>
        ))}
      </ol>
      <ActionForm action={register} className="space-y-5">
        {ref && <input type="hidden" name="ref" value={ref} />}
        <TextField label={t("auth.mobile")} name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" defaultValue={phone} hint={t("auth.mobileHint")} />
        <TextField label={t("auth.password")} name="password" type="password" minLength={8} required autoComplete="new-password" hint={t("auth.passwordHint")} autoFocus={Boolean(phone)} />
        <TextField label={t("auth.confirmPassword")} name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        <label className="flex items-start gap-3 rounded-lg bg-cream/70 p-3.5 text-sm leading-relaxed text-stone-600">
          <input type="checkbox" name="terms" required className="mt-1 accent-maroon" />
          {t("auth.terms")}
        </label>
        <label className="flex items-start gap-3 px-3.5 text-sm leading-relaxed text-stone-600">
          <input type="checkbox" name="whatsapp" className="mt-1 accent-maroon" />
          {t("auth.whatsapp")}
        </label>
        <SubmitButton className="w-full py-3.5">{t("auth.registerButton")}</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        {t("auth.alreadyRegistered")} <Link href="/login" className={authLinkCls}>{t("auth.loginButton")}</Link>
      </p>
    </AuthShell>
  );
}
