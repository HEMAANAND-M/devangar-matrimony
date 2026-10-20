import Link from "next/link";
import { redirect } from "next/navigation";
import { DotPattern, Mandala, SectionTitle } from "@/components/Ornaments";
import { getTestimonials } from "@/lib/content";
import { getCurrentUser } from "@/lib/session";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const FEATURES = [
  [
    "Community-only",
    "Profiles from the Devangar community, with gothram, kuladeivam and sub-sect details.",
    icon("M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8"),
  ],
  [
    "Verified & moderated",
    "Every mobile number is OTP-verified and every profile and photo is reviewed.",
    icon("M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4"),
  ],
  [
    "Horoscope details",
    "Star, rasi, dosham and birth details on every profile to help families decide.",
    icon("M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 16a4 4 0 100-8 4 4 0 000 8z"),
  ],
  [
    "Privacy first",
    "Contact numbers are shared only after both sides accept. Photos can be hidden until then.",
    icon("M5 11h14v10H5zM8 11V7a4 4 0 018 0v4"),
  ],
] as const;

const STEPS = [
  ["Register free", "Sign up with your mobile number and verify it with an OTP."],
  ["Create the profile", "Add basic, family, horoscope and partner details, then upload photos."],
  ["Get approved", "Our team reviews every profile before it appears in search."],
  ["Connect", "Search by star, age, height and more. Send interest; contacts open once accepted."],
];

const PRIVACY = [
  ["Contact details stay private", "Your mobile number is shown only to members whose interest you accept — never in search results."],
  ["You decide who sees your photos", "Show photos to all members, or only to families you have connected with."],
  ["Hide your profile any time", "Pause your search with one click and return whenever you are ready."],
  ["Report & review", "Any member can report a profile. Our team reviews each report and removes misuse."],
];

const SEARCH_BY = ["Star & rasi", "Age & height", "Mother tongue", "Dosham", "City", "Education", "Marital status", "Profile ID"];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { deleted } = await searchParams;
  const testimonials = await getTestimonials();
  return (
    <div className="-mt-10">
      {deleted && (
        <p role="status" className="full-bleed bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          Your account and all its data have been permanently deleted.
        </p>
      )}
      {/* Hero */}
      <section className="full-bleed relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light text-white">
        <DotPattern id="hero-dots" className="absolute inset-0 h-full w-full text-gold opacity-[0.12]" />
        <Mandala className="pointer-events-none absolute -right-40 -top-24 h-[640px] w-[640px] text-gold opacity-25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[1fr_400px] lg:py-28">
          <div>
            <p className="eyebrow text-gold-light">Exclusively for the Devanga community</p>
            <h1 className="mt-5 text-5xl leading-[1.05] !text-white sm:text-6xl lg:text-7xl">
              Where Devangar families <em className="font-medium text-gold-light">begin</em> a new chapter
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              A trusted, family-friendly matrimony service for Devanga brides and grooms in Tamil Nadu, Karnataka,
              Andhra Pradesh and around the world.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/85">
              {["OTP-verified mobiles", "Every profile reviewed", "Photo privacy controls"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 text-gold-light">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2.5 6.5l2 2 5-5" /></svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <form action="/register" className="relative rounded-2xl bg-white p-8 text-ink shadow-lift">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="eyebrow text-gold-dark">Begin your search</p>
            <h2 className="mt-2 text-3xl text-maroon">Register free</h2>
            <p className="mt-2 text-sm text-stone-600">Start with your mobile number — takes under a minute.</p>
            <label className="mt-6 block text-[0.8rem] font-medium tracking-wide text-stone-600">
              Mobile number
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
              Get started
            </button>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-500">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gold-dark" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              Your number is never shown publicly
            </p>
            <p className="mt-4 border-t border-hairline pt-4 text-center text-sm text-stone-600">
              Already a member? <Link href="/login" className="font-medium text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Log in</Link>
            </p>
          </form>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      </section>

      {/* Promise */}
      <section id="verification" className="scroll-mt-24 py-24">
        <SectionTitle
          eyebrow="Our promise"
          title="Built on trust, guided by tradition"
          subtitle="Every detail is designed so families can search with confidence and members stay in control of their information."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([title, body, glyph]) => (
            <div key={title} className="group rounded-2xl border border-hairline bg-white p-7 shadow-soft transition hover:-translate-y-0.5 hover:border-gold/50">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-cream text-maroon transition group-hover:bg-maroon group-hover:text-gold-light">
                {glyph}
              </span>
              <h3 className="mt-5 text-2xl text-maroon">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="full-bleed border-y border-hairline bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle eyebrow="Simple & secure" title="How it works" />
          <div className="relative mt-16">
          <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-gold/0 via-gold/50 to-gold/0 lg:block" aria-hidden />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative text-center">
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-cream font-display text-3xl font-semibold text-maroon shadow-soft">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-2xl text-ink">{title}</h3>
                <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-stone-600">{body}</p>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="grid scroll-mt-24 items-center gap-14 py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-gold-dark">Privacy you control</p>
          <h2 className="mt-3 text-4xl text-maroon sm:text-5xl">Your family’s details, shared only on your terms</h2>
          <p className="mt-5 leading-relaxed text-stone-600">
            Marriage is a personal decision. We keep contact details and photos protected until you choose to connect —
            and every profile is checked by a person before anyone can see it.
          </p>
          <Link href="/safety" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            Read our safety guidelines <span aria-hidden>→</span>
          </Link>
        </div>
        <ul className="space-y-4">
          {PRIVACY.map(([title, body]) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-hairline bg-white p-5 shadow-soft">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon text-gold-light">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2.5 6.5l2 2 5-5" /></svg>
              </span>
              <div>
                <h3 className="font-sans text-base font-semibold tracking-normal text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Testimonials: only real ones added by admins, so the section is absent until then */}
      {testimonials.length > 0 && (
        <section className="pb-24">
          <SectionTitle eyebrow="In their words" title="Families who found their match" />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.slice(0, 6).map((t) => (
              <figure key={t.names} className="relative flex flex-col rounded-3xl border border-hairline bg-white p-8 shadow-soft">
                <span className="absolute -top-4 left-8 font-display text-6xl leading-none text-gold" aria-hidden>“</span>
                <blockquote className="flex-1 pt-2 text-[0.95rem] leading-relaxed text-stone-700">{t.quote}</blockquote>
                <figcaption className="mt-6 border-t border-hairline pt-4">
                  <span className="block font-display text-lg font-semibold text-maroon">{t.names}</span>
                  {t.city && <span className="eyebrow text-gold-dark">{t.city}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link href="/stories" className="text-sm font-medium text-maroon underline decoration-gold/50 underline-offset-4">Read success stories</Link>
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
            eyebrow="Find your perfect match"
            title="Search the community by what matters to your family"
          />
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5 text-sm">
            {SEARCH_BY.map((s) => (
              <li key={s} className="rounded-full border border-gold/40 bg-white/5 px-4 py-1.5 text-gold-light backdrop-blur">{s}</li>
            ))}
          </ul>
          <Link
            href="/register"
            className="mt-12 inline-block rounded-full bg-gold px-10 py-4 text-sm font-semibold tracking-wide text-maroon-dark shadow-lift transition hover:bg-gold-light"
          >
            Register free
          </Link>
        </div>
      </section>
    </div>
  );
}
