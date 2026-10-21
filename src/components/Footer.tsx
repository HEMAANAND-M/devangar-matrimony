import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { type TKey, getLocale, getT } from "@/lib/i18n";
import { AppInstall } from "./AppInstall";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";

const COLUMNS: [TKey, [string, TKey][]][] = [
  ["footer.members", [["/register", "nav.registerFree"], ["/login", "footer.memberLogin"], ["/search", "footer.searchProfiles"], ["/upgrade", "footer.premium"]]],
  ["footer.community", [["/stories", "footer.stories"], ["/events", "footer.events"], ["/faq", "footer.faq"], ["/support", "footer.support"]]],
  ["footer.trust", [["/safety", "footer.safety"], ["/#verification", "footer.howWeVerify"], ["/#privacy", "footer.privacy"]]],
];

export async function Footer() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return (
    <footer className="mt-12 bg-maroon-dark text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">{t("footer.about")}</p>
          <LanguageSwitch locale={locale} label={t("lang.label")} tone="light" className="mt-6" />
          <div className="mt-4 empty:hidden"><AppInstall label={t("app.install")} /></div>
        </div>
        {COLUMNS.map(([title, links]) => (
          <div key={title}>
            <h2 className="eyebrow !font-sans text-gold-light">{t(title)}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-white">{t(label)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {SITE_NAME}. {t("footer.rights")}</p>
          <p className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            {t("footer.reviewed")}
          </p>
        </div>
      </div>
    </footer>
  );
}
