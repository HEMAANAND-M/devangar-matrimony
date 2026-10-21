"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AdSlide = { id: string; image: string; title: string; advertiser: string; category: string; tagline: string | null; linked: boolean };

type Labels = { sponsored: string; previous: string; next: string; goTo: string; region: string; visit: string };

const INTERVAL_MS = 5000;

/**
 * Sponsored banners. Auto-advances every 5 s (paused on hover, focus and for reduced motion), with
 * prev/next buttons, dots, arrow keys and swipe. The frame has a fixed aspect ratio, so nothing shifts.
 */
export function AdCarousel({ slides, labels }: { slides: AdSlide[]; labels: Labels }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const timer = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reducedMotion, count, go]);

  if (!count) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="relative aspect-[12/5] overflow-hidden rounded-2xl border border-hairline bg-sand shadow-soft sm:aspect-[8/3]">
        {slides.map((s, i) => {
          const active = i === index;
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- banners are served pre-sized from our own route */}
              <img src={s.image} alt={`${s.advertiser}: ${s.title}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
            </>
          );
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              {s.linked ? (
                <a
                  href={`/api/ads/${s.id}/click`}
                  target="_blank"
                  rel="sponsored noopener"
                  tabIndex={active ? 0 : -1}
                  aria-label={`${labels.visit}: ${s.advertiser} — ${s.title}`}
                  className="block h-full w-full focus-visible:outline-offset-[-4px]"
                >
                  {body}
                </a>
              ) : (
                body
              )}
            </div>
          );
        })}
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
          {labels.sponsored}
        </span>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.previous}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-maroon shadow-soft transition hover:bg-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-maroon shadow-soft transition hover:bg-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </>
        )}
      </div>
      {/* The caption sits below the banner so it never hides the advertiser's own artwork. */}
      <div className="mt-4 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-dark">{slides[index].category}</p>
        <p className="mt-1 font-display text-xl font-semibold text-maroon sm:text-2xl">{slides[index].title}</p>
        <p className="mt-0.5 text-sm text-stone-600">
          {slides[index].advertiser}
          {slides[index].tagline && <> · {slides[index].tagline}</>}
        </p>
      </div>
      {count > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`${labels.goTo} ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-maroon" : "w-2 bg-gold/50 hover:bg-gold"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
