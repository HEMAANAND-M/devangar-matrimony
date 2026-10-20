export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-hairline bg-white p-6 shadow-soft sm:p-7 ${className}`}>
      {title && (
        <div className="mb-5">
          <h2 className="text-2xl text-maroon">{title}</h2>
          <div className="mt-2 h-px w-10 bg-gold" />
        </div>
      )}
      {children}
    </section>
  );
}

/** Page heading with optional eyebrow and supporting line. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
      <div>
        {eyebrow && <p className="eyebrow text-gold-dark">{eyebrow}</p>}
        <h1 className="mt-1 text-4xl text-maroon sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
