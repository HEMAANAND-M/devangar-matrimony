/** Brand mark: two interlinked rings inside a fine gold circle, plus the wordmark. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="none">
      <circle cx="24" cy="24" r="22.5" stroke="#B08D57" strokeWidth="1" />
      <circle cx="24" cy="24" r="19.5" stroke="#B08D57" strokeWidth="0.5" opacity="0.6" />
      <circle cx="19.5" cy="25" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="28.5" cy="25" r="7" stroke="#B08D57" strokeWidth="1.6" />
      <path d="M24 10.5l1.6 2.6-1.6 2.6-1.6-2.6z" fill="#B08D57" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-3 ${light ? "text-white" : "text-maroon"}`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-2xl font-semibold tracking-tight">Devangar</span>
        <span className={`eyebrow mt-1 !text-[0.6rem] ${light ? "text-gold-light" : "text-gold-dark"}`}>Matrimony</span>
      </span>
    </span>
  );
}
