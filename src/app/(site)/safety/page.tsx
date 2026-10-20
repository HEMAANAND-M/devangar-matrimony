import { Card, PageHeader } from "@/components/Card";
import { getSafety } from "@/lib/content";

export const metadata = { title: "Safety guidelines" };

export default async function SafetyPage() {
  const sections = await getSafety();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Trust & safety"
        title="Safety guidelines"
        subtitle="Simple practices that keep you and your family safe while you search."
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
