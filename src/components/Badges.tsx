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
