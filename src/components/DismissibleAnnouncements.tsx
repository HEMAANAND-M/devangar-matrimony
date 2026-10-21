"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type AnnouncementItem = { id: string; title: string; body: string; href: string | null };

const KEY = "dm_dismissed_announcements";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Renders only after mount so a dismissed banner never flashes back on page load. */
export function DismissibleAnnouncements({
  items,
  learnMore = "Learn more",
  dismissLabel = "Dismiss: {title}",
}: {
  items: AnnouncementItem[];
  learnMore?: string;
  dismissLabel?: string;
}) {
  const [visible, setVisible] = useState<AnnouncementItem[] | null>(null);
  useEffect(() => {
    const dismissed = readDismissed();
    setVisible(items.filter((a) => !dismissed.includes(a.id)));
  }, [items]);
  if (!visible?.length) return null;

  const dismiss = (id: string) => {
    try {
      // Only ids still live are kept, so the list never grows without bound.
      const next = [...readDismissed().filter((d) => items.some((a) => a.id === d)), id];
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setVisible((v) => v?.filter((a) => a.id !== id) ?? null);
  };

  return (
    <div className="border-b border-gold/30 bg-gradient-to-r from-gold-light/60 via-cream to-gold-light/60">
      {visible.map((a) => (
        <div key={a.id} role="note" aria-label="Announcement" className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 text-sm text-maroon-dark sm:items-center">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold-dark sm:mt-0" aria-hidden />
          <p className="flex-1">
            <span className="font-semibold">{a.title}</span> <span className="text-stone-700">{a.body}</span>
            {a.href && (
              <Link href={a.href} className="ml-2 whitespace-nowrap font-medium text-maroon underline decoration-gold underline-offset-4">
                {learnMore}
              </Link>
            )}
          </p>
          <button type="button" onClick={() => dismiss(a.id)} aria-label={dismissLabel.replace("{title}", a.title)} className="rounded-full p-1 text-stone-500 transition hover:bg-white/60 hover:text-maroon">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
