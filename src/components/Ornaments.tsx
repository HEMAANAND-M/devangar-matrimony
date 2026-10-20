/** Fine-line mandala drawn from rotated petals; purely decorative. */
export function Mandala({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" stroke="currentColor" aria-hidden>
      {[190, 160, 120, 70].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} strokeWidth="0.6" />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <ellipse key={`o${i}`} cx="200" cy="85" rx="16" ry="44" strokeWidth="0.6" transform={`rotate(${i * 15} 200 200)`} />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={`i${i}`} cx="200" cy="150" rx="10" ry="30" strokeWidth="0.6" transform={`rotate(${i * 30 + 15} 200 200)`} />
      ))}
      {Array.from({ length: 48 }, (_, i) => (
        <circle key={`d${i}`} cx="200" cy="12" r="1.6" fill="currentColor" stroke="none" transform={`rotate(${i * 7.5} 200 200)`} />
      ))}
    </svg>
  );
}

/** Repeating kolam-style dot lattice, used as a subtle background texture. */
export function DotPattern({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="14" r="1" fill="currentColor" />
          <path d="M14 4l3 3-3 3-3-3z" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, light = false }: { eyebrow: string; title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={`eyebrow ${light ? "text-gold-light" : "text-gold-dark"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-4xl sm:text-5xl ${light ? "!text-white" : "text-maroon"}`}>{title}</h2>
      <div className="ornament mt-5 justify-center">
        <svg viewBox="0 0 10 10" className="h-2 w-2" fill="currentColor" aria-hidden><path d="M5 0l5 5-5 5-5-5z" /></svg>
      </div>
      {subtitle && <p className={`mt-5 leading-relaxed ${light ? "text-white/75" : "text-stone-600"}`}>{subtitle}</p>}
    </div>
  );
}
