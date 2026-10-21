import { getT } from "@/lib/i18n";

export async function PremiumBadge({ small = false }: { small?: boolean }) {
  const t = await getT();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-dark font-sans font-semibold tracking-wide text-white shadow-sm ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title={t("badge.premiumTitle")}
    >
      <svg viewBox="0 0 20 20" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="currentColor" aria-hidden>
        <path d="M2 6l4 3 4-6 4 6 4-3-2 10H4L2 6z" />
      </svg>
      {t("badge.premium")}
    </span>
  );
}

export async function IdVerifiedBadge({ small = false }: { small?: boolean }) {
  const t = await getT();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 font-sans font-medium text-sky-800 ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title={t("badge.idTitle")}
    >
      <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="12" r="2.5" />
        <path d="M14 10h4M14 14h3" />
      </svg>
      {t("badge.id")}
    </span>
  );
}

export async function PhotoVerifiedBadge({ small = false }: { small?: boolean }) {
  const t = await getT();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 font-sans font-medium text-violet-800 ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title={t("badge.photoTitle")}
    >
      <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      {t("badge.photo")}
    </span>
  );
}

export async function PhoneVerifiedBadge() {
  const t = await getT();
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-sans text-xs font-medium text-emerald-800"
      title={t("badge.mobileTitle")}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M10 17h4" />
      </svg>
      {t("badge.mobile")}
    </span>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Active today" / "Active this week" / "Active this month"; nothing for older or unknown activity. */
export function activityLabel(lastActiveAt: Date | null | undefined, now = Date.now()): string | null {
  if (!lastActiveAt) return null;
  const age = now - lastActiveAt.getTime();
  if (age < DAY_MS) return "Active today";
  if (age < 7 * DAY_MS) return "Active this week";
  if (age < 30 * DAY_MS) return "Active this month";
  return null;
}

const ACTIVITY_KEYS = { "Active today": "badge.activeToday", "Active this week": "badge.activeWeek", "Active this month": "badge.activeMonth" } as const;

export async function ActiveIndicator({ lastActiveAt, className = "" }: { lastActiveAt: Date | null | undefined; className?: string }) {
  const label = activityLabel(lastActiveAt);
  if (!label) return null;
  const fresh = label === "Active today";
  const text = (await getT())(ACTIVITY_KEYS[label as keyof typeof ACTIVITY_KEYS]);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-stone-600 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${fresh ? "bg-emerald-500" : "bg-emerald-300"}`} aria-hidden />
      {text}
    </span>
  );
}

/** Small "86% match" pill; colour follows the score. */
export async function MatchBadge({ score, small = false }: { score: number; small?: boolean }) {
  const t = await getT();
  const tone = score >= 75 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : score >= 55 ? "border-gold/50 bg-gold-light/40 text-gold-dark" : "border-hairline bg-stone-50 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full border font-sans font-semibold tabular-nums ${tone} ${small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"}`} title={t("badge.matchTitle")}>
      {t("badge.match", { score })}
    </span>
  );
}
