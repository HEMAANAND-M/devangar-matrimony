import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AdCarousel } from "@/components/AdCarousel";
import { DotPattern, Mandala, SectionTitle } from "@/components/Ornaments";
import { adImageUrl, getLiveAds, recordImpressions } from "@/lib/ads";
import { getTestimonials } from "@/lib/content";
import { clientIp } from "@/lib/rate-limit";
import { type TKey, getT } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const FEATURES = [
  [
    "home.f1Title",
    "home.f1Body",
    icon("M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8"),
  ],
  [
    "home.f2Title",
    "home.f2Body",
    icon("M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4"),
  ],
  [
    "home.f3Title",
    "home.f3Body",
    icon("M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 16a4 4 0 100-8 4 4 0 000 8z"),
  ],
  [
    "home.f4Title",
    "home.f4Body",
    icon("M5 11h14v10H5zM8 11V7a4 4 0 018 0v4"),
  ],
] as const;

const STEPS: [TKey, TKey][] = [
  ["home.s1Title", "home.s1Body"],
  ["home.s2Title", "home.s2Body"],
  ["home.s3Title", "home.s3Body"],
  ["home.s4Title", "home.s4Body"],
];

const PRIVACY: [TKey, TKey][] = [
  ["home.p1Title", "home.p1Body"],
  ["home.p2Title", "home.p2Body"],
  ["home.p3Title", "home.p3Body"],
  ["home.p4Title", "home.p4Body"],
];

const SEARCH_BY: TKey[] = ["home.by1", "home.by2", "home.by3", "home.by4", "home.by5", "home.by6", "home.by7", "home.by8"];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { deleted } = await searchParams;
  const [testimonials, t, ads] = await Promise.all([getTestimonials(), getT(), getLiveAds()]);
  if (ads.length) {
    const ip = await clientIp();
    after(() => recordImpressions(ads.map((a) => a.id), ip));
  }
  return (
    <div className="-mt-10">
      {deleted && (
        <p role="status" className="full-bleed bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          {t("home.deleted")}
        </p>
      )}
      {/* Hero */}
      <section className="full-bleed relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light text-white">
        <DotPattern id="hero-dots" className="absolute inset-0 h-full w-full text-gold opacity-[0.12]" />
        <Mandala className="pointer-events-none absolute -right-40 -top-24 h-[640px] w-[640px] text-gold opacity-25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[1fr_400px] lg:py-28">
          <div>
            <p className="eyebrow text-gold-light">{t("home.eyebrow")}</p>
            <h1 className="mt-5 text-5xl leading-[1.05] !text-white sm:text-6xl lg:text-7xl">
              {t("home.titleA")} <em className="font-medium text-gold-light">{t("home.titleEm")}</em> {t("home.titleB")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              {t("home.lead")}
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/85">
              {[t("home.point1"), t("home.point2"), t("home.point3")].map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 text-gold-light">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2.5 6.5l2 2 5-5" /></svg>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <form action="/register" className="relative rounded-2xl bg-white p-8 text-ink shadow-lift">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="eyebrow text-gold-dark">{t("home.formEyebrow")}</p>
            <h2 className="mt-2 text-3xl text-maroon">{t("home.formTitle")}</h2>
            <p className="mt-2 text-sm text-stone-600">{t("home.formLead")}</p>
            <label className="mt-6 block text-[0.8rem] font-medium tracking-wide text-stone-600">
              {t("home.mobile")}
              <span className="mt-1.5 flex overflow-hidden rounded-lg border border-hairline bg-cream/40 transition focus-within:border-gold focus-within:bg-white focus-within:ring-4 focus-within:ring-gold/15">
                <span className="flex items-center border-r border-hairline bg-sand/60 px-3.5 text-sm text-stone-600">+91</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  placeholder="98765 43210"
                  required
                  autoComplete="tel-national"
                  className="w-full bg-transparent px-3.5 py-3 text-sm focus:outline-none"
                />
              </span>
            </label>
            <button className="mt-5 w-full rounded-full bg-maroon px-4 py-3.5 text-sm font-medium tracking-wide text-white shadow-soft transition hover:bg-maroon-dark">
              {t("home.getStarted")}
            </button>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-500">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gold-dark" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              {t("home.neverPublic")}
            </p>
            <p className="mt-4 border-t border-hairline pt-4 text-center text-sm text-stone-600">
              {t("home.alreadyMember")} <Link href="/login" className="font-medium text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t("home.login")}</Link>
            </p>
          </form>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      </section>

      {/* Promise */}
      <section id="verification" className="scroll-mt-24 py-24">
        <SectionTitle
          eyebrow={t("home.promiseEyebrow")}
          title={t("home.promiseTitle")}
          subtitle={t("home.promiseLead")}
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([title, body, glyph]) => (
            <div key={title} className="group rounded-2xl border border-hairline bg-white p-7 shadow-soft transition hover:-translate-y-0.5 hover:border-gold/50">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-cream text-maroon transition group-hover:bg-maroon group-hover:text-gold-light">
                {glyph}
              </span>
              <h3 className="mt-5 text-2xl text-maroon">{t(title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{t(body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="full-bleed border-y border-hairline bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle eyebrow={t("home.howEyebrow")} title={t("home.howTitle")} />
          <div className="relative mt-16">
          <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-gold/0 via-gold/50 to-gold/0 lg:block" aria-hidden />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative text-center">
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-cream font-display text-3xl font-semibold text-maroon shadow-soft">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-2xl text-ink">{t(title)}</h3>
                <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-stone-600">{t(body)}</p>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* Sponsored wedding services, managed in Admin → Advertisements; absent when none are live */}
      {ads.length > 0 && (
        <section className="py-20" aria-label={t("home.adsTitle")}>
          <SectionTitle eyebrow={t("home.adsEyebrow")} title={t("home.adsTitle")} subtitle={t("home.adsSubtitle")} />
          <div className="mx-auto mt-12 max-w-5xl">
            <AdCarousel
              slides={ads.map((a) => ({
                id: a.id,
                image: adImageUrl(a),
                title: a.title,
                advertiser: a.advertiser,
                category: t(`ads.cat.${a.category}` as TKey),
                tagline: a.tagline,
                linked: !!a.href,
              }))}
              labels={{
                sponsored: t("ads.sponsored"),
                previous: t("ads.previous"),
                next: t("ads.next"),
                goTo: t("ads.goTo"),
                region: t("ads.region"),
                visit: t("ads.visit"),
              }}
            />
          </div>
        </section>
      )}

      {/* Privacy */}
      <section id="privacy" className="grid scroll-mt-24 items-center gap-14 py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-gold-dark">{t("home.privacyEyebrow")}</p>
          <h2 className="mt-3 text-4xl text-maroon sm:text-5xl">{t("home.privacyTitle")}</h2>
          <p className="mt-5 leading-relaxed text-stone-600">
            {t("home.privacyLead")}
          </p>
          <Link href="/safety" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            {t("home.safetyLink")} <span aria-hidden>→</span>
          </Link>
        </div>
        <ul className="space-y-4">
          {PRIVACY.map(([title, body]) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-hairline bg-white p-5 shadow-soft">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon text-gold-light">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2.5 6.5l2 2 5-5" /></svg>
              </span>
              <div>
                <h3 className="font-sans text-base font-semibold tracking-normal text-ink">{t(title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{t(body)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Testimonials: only real ones added by admins, so the section is absent until then */}
      {testimonials.length > 0 && (
        <section className="pb-24">
          <SectionTitle eyebrow={t("home.testimonialsEyebrow")} title={t("home.testimonialsTitle")} />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.slice(0, 6).map((item) => (
              <figure key={item.names} className="relative flex flex-col rounded-3xl border border-hairline bg-white p-8 shadow-soft">
                <span className="absolute -top-4 left-8 font-display text-6xl leading-none text-gold" aria-hidden>“</span>
                <blockquote className="flex-1 pt-2 text-[0.95rem] leading-relaxed text-stone-700">{item.quote}</blockquote>
                <figcaption className="mt-6 border-t border-hairline pt-4">
                  <span className="block font-display text-lg font-semibold text-maroon">{item.names}</span>
                  {item.city && <span className="eyebrow text-gold-dark">{item.city}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link href="/stories" className="text-sm font-medium text-maroon underline decoration-gold/50 underline-offset-4">{t("home.readStories")}</Link>
          </p>
        </section>
      )}

      {/* Closing CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-maroon-dark to-maroon px-6 py-20 text-center text-white shadow-lift">
        <DotPattern id="cta-dots" className="absolute inset-0 h-full w-full text-gold opacity-10" />
        <Mandala className="pointer-events-none absolute -bottom-48 -left-32 h-[480px] w-[480px] text-gold opacity-20" />
        <div className="relative">
          <SectionTitle
            light
            eyebrow={t("home.ctaEyebrow")}
            title={t("home.ctaTitle")}
          />
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5 text-sm">
            {SEARCH_BY.map((s) => (
              <li key={s} className="rounded-full border border-gold/40 bg-white/5 px-4 py-1.5 text-gold-light backdrop-blur">{t(s)}</li>
            ))}
          </ul>
          <Link
            href="/register"
            className="mt-12 inline-block rounded-full bg-gold px-10 py-4 text-sm font-semibold tracking-wide text-maroon-dark shadow-lift transition hover:bg-gold-light"
          >
            {t("home.registerFree")}
          </Link>
        </div>
      </section>
    </div>
  );
}
