"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormState } from "@/lib/form";

/** "Resend code" with a countdown matching the server's 60-second cooldown. */
export function ResendCodeButton({ action, initialWait }: { action: () => Promise<FormState>; initialWait: number }) {
  const [wait, setWait] = useState(initialWait);
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending || wait > 0}
        onClick={() =>
          startTransition(async () => {
            const r = await action();
            if (r.redirect) return window.location.replace(r.redirect);
            setResult(r);
            if (!r.error) setWait(60);
          })
        }
        className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
      </button>
      <p aria-live="polite" className="min-h-5 text-xs">
        {result?.error && <span className="text-red-700">{result.error}</span>}
        {result?.message && <span className="text-emerald-700">{result.message}</span>}
      </p>
    </div>
  );
}
