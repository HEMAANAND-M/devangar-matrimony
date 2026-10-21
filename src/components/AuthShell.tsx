import { getT } from "@/lib/i18n";
import { LogoMark } from "./Logo";
import { DotPattern, Mandala } from "./Ornaments";

const POINTS = ["auth.point1", "auth.point2", "auth.point3"] as const;

/** Two-panel layout for login, registration and OTP pages. */
export async function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-hairline bg-white shadow-lift lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light p-10 text-white lg:flex lg:flex-col">
        <DotPattern id="auth-dots" className="absolute inset-0 h-full w-full text-gold opacity-10" />
        <Mandala className="pointer-events-none absolute -bottom-40 -right-40 h-[460px] w-[460px] text-gold opacity-25" />
        <div className="relative text-white">
          <LogoMark className="h-14 w-14" />
        </div>
        <div className="relative mt-auto">
          <p className="font-display text-4xl font-medium leading-tight">
            {t("auth.quote")}
          </p>
          <div className="mt-6 h-px w-12 bg-gold" />
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 text-gold-light">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2.5 6.5l2 2 5-5" /></svg>
                </span>
                {t(p)}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="p-8 sm:p-12">
        <p className="eyebrow text-gold-dark">{eyebrow}</p>
        <h1 className="mt-2 text-4xl text-maroon">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-stone-600">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export const authLinkCls = "font-medium text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold";
