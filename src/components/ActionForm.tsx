"use client";

import { createContext, useActionState, useContext, startTransition } from "react";
import type { FormState } from "@/lib/form";

const PendingContext = createContext(false);

/**
 * Form bound to a server action that returns FormState. Submits via a transition
 * instead of the `action` prop so React does not reset the fields on error.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {state.error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-800">
          {state.message}
        </p>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const pending = useContext(PendingContext);
  const styles = {
    primary: "bg-maroon text-white shadow-soft hover:bg-maroon-dark",
    secondary: "border border-gold/60 text-maroon hover:border-gold hover:bg-gold-light/30",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-full px-6 py-2.5 text-sm font-medium tracking-wide transition disabled:opacity-60 ${styles} ${className}`}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
