import Link from "next/link";

/**
 * Building blocks for admin portal pages. Admin screens are denser than member pages: sans-serif
 * headings, compact tables, and the brand colours used only for emphasis.
 */

export function AdminPageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: [href: string, label: string][];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            {breadcrumbs.map(([href, label], i) => (
              <span key={href} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={href} className="hover:text-maroon">{label}</Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  flush = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No inner padding: for tables that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-hairline bg-white shadow-[0_1px_2px_rgb(30_26_23/0.04)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div>
            {title && <h2 className="font-sans text-[0.95rem] font-semibold tracking-normal text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "neutral" | "attention";
}) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-2 font-sans text-3xl font-semibold tabular-nums tracking-tight ${tone === "attention" ? "text-maroon" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </>
  );
  const cls = `block rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgb(30_26_23/0.04)] ${
    tone === "attention" ? "border-gold/60" : "border-hairline"
  }`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-gold hover:shadow-soft`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const TONES = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gold: "bg-gold-light/50 text-gold-dark ring-gold/40",
  maroon: "bg-maroon/5 text-maroon ring-maroon/20",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Badge tone for the common status enums. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "APPROVED": case "PAID": case "ACTIVE": case "SENT": case "RESOLVED": case "MARRIED":
      return "green";
    case "PENDING": case "OPEN": case "CREATED":
      return "amber";
    case "REJECTED": case "FAILED": case "BANNED": case "SUSPENDED":
      return "red";
    case "REFUNDED": case "HIDDEN": case "NOT_CONFIGURED":
      return "neutral";
    default:
      return "neutral";
  }
}

export const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sand text-gold-dark" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12l4 4L19 7" /></svg>
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{children}</p>}
    </div>
  );
}

/** Edge-to-edge table for use inside a flush Panel. */
export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-hairline bg-cream/60 text-xs uppercase tracking-wider text-stone-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-2.5 font-medium first:pl-5 last:pr-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top first:pl-5 last:pr-5 ${className}`}>{children}</td>;
}

/** Previous / next links that keep the current query string. */
export function Pagination({
  page,
  pageCount,
  params,
  basePath,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || v === undefined) continue;
      for (const item of Array.isArray(v) ? v : [v]) if (item) q.append(k, item);
    }
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const btn = "rounded-lg border border-hairline px-3 py-1.5 text-sm transition hover:border-gold hover:text-maroon";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3 text-sm text-stone-600">
      <span>Page {page} of {pageCount}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={btn}>Previous</Link> : <span className={`${btn} opacity-40`}>Previous</span>}
        {page < pageCount ? <Link href={href(page + 1)} className={btn}>Next</Link> : <span className={`${btn} opacity-40`}>Next</span>}
      </span>
    </nav>
  );
}

/** GET form for list filters; children are inputs/selects using the classes below. */
export function FilterBar({ children, resetHref }: { children: React.ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 border-b border-hairline bg-cream/40 px-5 py-3.5">
      {children}
      <button className="rounded-lg bg-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-maroon-dark">Apply</button>
      <Link href={resetHref} className="px-2 py-2 text-sm text-stone-500 hover:text-maroon">Reset</Link>
    </form>
  );
}

export const inputCls =
  "rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25";
export const selectCls = inputCls;

export function FilterField({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {text}
      {children}
    </label>
  );
}

export const buttonCls = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-maroon-dark disabled:opacity-60",
  secondary: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:border-gold hover:text-maroon disabled:opacity-60",
  success: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-stone-600 transition hover:bg-sand hover:text-maroon disabled:opacity-60",
} as const;
