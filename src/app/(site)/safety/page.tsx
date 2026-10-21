import { Card, PageHeader } from "@/components/Card";
import { getSafety } from "@/lib/content";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Safety guidelines" };

export default async function SafetyPage() {
  const [sections, t] = await Promise.all([getSafety(), getT()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={t("safety.eyebrow")}
        title={t("safety.title")}
        subtitle={t("safety.subtitle")}
      />
      <div className="space-y-6">
        {sections.map(({ title, items }) => (
          <Card key={title} title={title}>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-stone-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
