import { PageHeader } from "@/components/Card";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";

export const metadata = {
  title: "Community events",
  description: "Devangar community meets, temple festivals and matrimony gatherings.",
};

const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
const month = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
const when = (d: Date) => d.toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function EventsPage() {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.event.findMany({ where: { published: true, OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }, orderBy: { startsAt: "asc" }, take: 30 }),
    db.event.findMany({ where: { published: true, startsAt: { lt: now }, OR: [{ endsAt: null }, { endsAt: { lt: now } }] }, orderBy: { startsAt: "desc" }, take: 12 }),
  ]);

  const t = await getT();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("events.eyebrow")} title={t("events.title")} subtitle={t("events.subtitle")} />
      {upcoming.length ? (
        <ol className="space-y-5">
          {upcoming.map((e) => (
            <li key={e.id} className="flex gap-5 rounded-2xl border border-hairline bg-white p-6 shadow-soft">
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-maroon to-maroon-dark text-white">
                <span className="font-display text-3xl font-semibold leading-none">{day(e.startsAt)}</span>
                <span className="eyebrow mt-1 text-gold-light">{month(e.startsAt)}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl text-maroon">{e.title}</h2>
                <p className="mt-1 text-sm text-stone-600">{when(e.startsAt)} · {e.location}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">{e.description}</p>
                {e.href && (
                  <a href={e.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4">
                    {t("events.details")}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-hairline bg-white px-6 py-10 text-center text-stone-600 shadow-soft">{t("events.none")}</p>
      )}

      {past.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl text-maroon">{t("events.past")}</h2>
          <ul className="mt-4 divide-y divide-hairline rounded-2xl border border-hairline bg-white px-6 shadow-soft">
            {past.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-ink">{e.title}</span>
                <span className="text-stone-500">{e.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })} · {e.location}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
