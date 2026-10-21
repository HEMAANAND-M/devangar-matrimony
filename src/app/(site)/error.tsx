"use client";

import { useEffect, useState } from "react";

// Client component: the server dictionaries aren't available here, so the copy for both
// languages lives inline (same wording as the "error.*" keys) and follows <html lang>.
const COPY = {
  en: {
    eyebrow: "Something went wrong",
    title: "We hit a snag",
    body: "Please try again. If it keeps happening, contact support",
    reference: "and mention reference",
    retry: "Try again",
  },
  ta: {
    eyebrow: "ஏதோ தவறு நடந்துவிட்டது",
    title: "ஒரு சிக்கல் ஏற்பட்டது",
    body: "மீண்டும் முயற்சிக்கவும். தொடர்ந்து நடந்தால், உதவியைத் தொடர்புகொள்ளுங்கள்",
    reference: "இந்தக் குறிப்பு எண்ணைக் குறிப்பிடுங்கள்:",
    retry: "மீண்டும் முயற்சி",
  },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<"en" | "ta">("en");
  useEffect(() => setLang(document.documentElement.lang === "ta" ? "ta" : "en"), []);
  const c = COPY[lang];
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="eyebrow text-gold-dark">{c.eyebrow}</p>
      <h1 className="mt-3 text-5xl text-maroon">{c.title}</h1>
      <p className="mt-4 text-stone-600">
        {c.body}
        {error.digest && <> {c.reference} <code className="rounded bg-sand px-1.5 py-0.5 text-xs">{error.digest}</code></>}.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-maroon px-8 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark"
      >
        {c.retry}
      </button>
    </div>
  );
}
