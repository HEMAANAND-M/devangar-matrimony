import { type TKey, getT, getTx } from "@/lib/i18n";
import type { PoruthamReport } from "@/lib/porutham";

export async function PoruthamCard({ report }: { report: PoruthamReport }) {
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const pct = report.score / report.total;
  const verdict = t(!report.essentialOk ? "porutham.essentialMissing" : pct >= 0.7 ? "porutham.good" : pct >= 0.5 ? "porutham.average" : "porutham.low");
  const tone = !report.essentialOk ? "text-red-700" : pct >= 0.7 ? "text-emerald-700" : pct >= 0.5 ? "text-amber-700" : "text-red-700";
  // Ring progress: circumference of r=34 is ~213.6.
  const dash = 213.6 * pct;

  return (
    <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-white to-cream p-6 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e8e0d3" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#b08d57" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} 213.6`} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-semibold leading-none text-maroon">{report.score}</span>
            <span className="text-[0.65rem] text-stone-500">{t("porutham.of", { total: report.total })}</span>
          </span>
        </div>
        <div>
          <p className="eyebrow text-gold-dark">{t("porutham.eyebrow")}</p>
          <h2 className="mt-1 text-2xl text-maroon">{t("porutham.title")}</h2>
          <p className={`mt-1 text-sm font-medium ${tone}`}>{verdict}</p>
        </div>
      </div>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {report.results.map((r) => (
          <li key={r.name} className="flex items-start gap-3 rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                r.matched ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
              }`}
              aria-label={t(r.matched ? "porutham.matched" : "porutham.notMatched")}
            >
              {r.matched ? "✓" : "✕"}
            </span>
            <span>
              <span className="font-medium text-ink">
                {t(`porutham.${r.name}` as TKey)}
                {r.essential && <span className="ml-1.5 text-[0.65rem] uppercase tracking-wider text-gold-dark">{t("porutham.essential")}</span>}
              </span>
              <span className="block text-xs text-stone-500">{tx(r.note)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-stone-500">
        {t("porutham.note")}
      </p>
    </section>
  );
}
