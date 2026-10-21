import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/Card";
import { getFaq } from "@/lib/content";
import { getT } from "@/lib/i18n";

export const metadata = {
  title: "Frequently asked questions",
  description: "Answers about registration, privacy, verification and premium membership on Devangar Matrimony.",
};

export default async function FaqPage() {
  const [faq, nonce] = await Promise.all([getFaq(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        nonce={nonce}
        // "<" is escaped so answer text can never close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PageHeader eyebrow={t("faq.eyebrow")} title={t("faq.title")} subtitle={t("faq.subtitle")} />
      <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-white shadow-soft">
        {faq.map((f) => (
          <details key={f.q} className="group px-6 py-5 sm:px-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-display text-xl font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/50 text-gold-dark transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-10 text-center text-sm text-stone-600">
        {t("faq.still")} <Link href="/support" className="text-maroon underline decoration-gold/50 underline-offset-4">{t("faq.contact")}</Link>.
      </p>
    </div>
  );
}
