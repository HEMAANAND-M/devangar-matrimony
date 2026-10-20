"use client";

import { useEffect, useState } from "react";

/**
 * Discourages casual copying of member photos: blurred until tapped, re-blurred when the page
 * loses focus (switching apps, screenshot tools), and no right-click / long-press save or drag.
 * Determined users can still capture the screen; the watermark covers that case.
 */
export function ProtectedPhoto({ src, alt }: { src: string; alt: string }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const hide = () => setRevealed(false);
    const onVisibility = () => document.visibilityState !== "visible" && hide();
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      className="relative select-none overflow-hidden [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        data-revealed={revealed}
        className={`pointer-events-none w-full object-cover transition duration-500 ${revealed ? "" : "scale-105 blur-xl"}`}
      />
      {/* Transparent shield: long-press and "save image" target this, not the photo. */}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Hide photo" : "Show photo"}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!revealed && (
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-maroon shadow-lift backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Tap to view photo
          </span>
        )}
      </button>
    </div>
  );
}
