export function PremiumBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-dark font-sans font-semibold tracking-wide text-white shadow-sm ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title="Premium member"
    >
      <svg viewBox="0 0 20 20" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="currentColor" aria-hidden>
        <path d="M2 6l4 3 4-6 4 6 4-3-2 10H4L2 6z" />
      </svg>
      Premium
    </span>
  );
}

export function IdVerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 font-sans font-medium text-sky-800 ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title="Government ID checked by our team"
    >
      <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="12" r="2.5" />
        <path d="M14 10h4M14 14h3" />
      </svg>
      ID verified
    </span>
  );
}

export function PhotoVerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 font-sans font-medium text-violet-800 ${
        small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"
      }`}
      title="A live selfie was matched to this member's photos by our team"
    >
      <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-3 w-3"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      Photo verified
    </span>
  );
}

export function PhoneVerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-sans text-xs font-medium text-emerald-800"
      title="Mobile number verified by OTP"
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M10 17h4" />
      </svg>
      Mobile verified
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

export function ActiveIndicator({ lastActiveAt, className = "" }: { lastActiveAt: Date | null | undefined; className?: string }) {
  const text = activityLabel(lastActiveAt);
  if (!text) return null;
  const fresh = text === "Active today";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-stone-600 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${fresh ? "bg-emerald-500" : "bg-emerald-300"}`} aria-hidden />
      {text}
    </span>
  );
}

/** Small "86% match" pill; colour follows the score. */
export function MatchBadge({ score, small = false }: { score: number; small?: boolean }) {
  const tone = score >= 75 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : score >= 55 ? "border-gold/50 bg-gold-light/40 text-gold-dark" : "border-hairline bg-stone-50 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full border font-sans font-semibold tabular-nums ${tone} ${small ? "px-2 py-0.5 text-[0.6rem]" : "px-2.5 py-1 text-xs"}`} title="Compatibility based on both members' preferences and porutham">
      {score}% match
    </span>
  );
}
