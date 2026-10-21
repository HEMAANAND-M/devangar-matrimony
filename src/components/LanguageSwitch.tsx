"use client";

import { useTransition } from "react";
import { setLanguage } from "@/app/actions/locale";

/** "English | தமிழ்". Reloads after saving so every server-rendered string switches language. */
export function LanguageSwitch({ locale, label, className = "", tone = "dark" }: { locale: "en" | "ta"; label: string; className?: string; tone?: "dark" | "light" }) {
  const [pending, startTransition] = useTransition();
  const choose = (next: "en" | "ta") => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLanguage(next);
      window.location.reload();
    });
  };
  const idle = tone === "light" ? "text-white/60 hover:text-white" : "text-stone-500 hover:text-maroon";
  const active = tone === "light" ? "font-semibold text-white" : "font-semibold text-maroon";
  return (
    <div role="group" aria-label={label} className={`flex items-center gap-1.5 text-sm ${pending ? "opacity-60" : ""} ${className}`}>
      <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => choose("en")} className={locale === "en" ? active : idle}>
        English
      </button>
      <span aria-hidden className={tone === "light" ? "text-white/30" : "text-stone-300"}>|</span>
      <button type="button" lang="ta" aria-pressed={locale === "ta"} onClick={() => choose("ta")} className={locale === "ta" ? active : idle}>
        தமிழ்
      </button>
    </div>
  );
}
