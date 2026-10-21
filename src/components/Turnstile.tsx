"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; theme?: string; language?: string }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget. It adds a `cf-turnstile-response` field to the surrounding form.
 * Tokens are single-use, so the widget re-arms after every submit in case the form returns an error.
 */
export function Turnstile({ siteKey, language = "auto" }: { siteKey: string; language?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (!cancelled && window.turnstile) id = window.turnstile.render(el, { sitekey: siteKey, theme: "light", language });
      })
      .catch(() => {});
    const form = el.closest("form");
    const rearm = () => setTimeout(() => id && window.turnstile?.reset(id), 1500);
    form?.addEventListener("submit", rearm);
    return () => {
      cancelled = true;
      form?.removeEventListener("submit", rearm);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, language]);
  return <div ref={ref} className="min-h-[65px]" />;
}
