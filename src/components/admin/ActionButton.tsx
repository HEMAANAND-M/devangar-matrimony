"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/form";
import { buttonCls } from "./ui";

/**
 * Button that runs a server action with visible feedback: a pending label, an optional confirm
 * prompt, and the action's message or error shown next to it. Use for one-click admin actions
 * (approve, dismiss, force logout…). The action may return FormState or nothing.
 */
export function ActionButton({
  action,
  children,
  pendingLabel = "Working…",
  doneLabel = "Done",
  confirm,
  variant = "secondary",
  className = "",
}: {
  action: () => Promise<FormState | void>;
  children: React.ReactNode;
  pendingLabel?: string;
  doneLabel?: string;
  confirm?: string;
  variant?: keyof typeof buttonCls;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormState | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={`${buttonCls[variant]} ${className}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setResult(null);
          startTransition(async () => {
            try {
              const r = await action();
              setResult(r ?? { message: doneLabel });
              if (r?.redirect) window.location.assign(r.redirect);
            } catch {
              setResult({ error: "Something went wrong. Please try again." });
            }
          });
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      {result?.error && <span role="alert" className="text-xs text-red-700">{result.error}</span>}
      {result?.message && <span role="status" className="text-xs text-emerald-700">✓ {result.message}</span>}
    </span>
  );
}
