"use client";

import { useActionState, useState, startTransition } from "react";
import { buttonCls } from "@/components/admin/ui";
import type { FormState } from "@/lib/form";

/** Wraps the members table so rows can be ticked and approved in one go. */
export function BulkForm({
  action,
  children,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [selected, setSelected] = useState(0);
  return (
    <form
      onChange={(e) => {
        const form = e.currentTarget;
        const target = e.target as unknown as HTMLInputElement;
        if (target.name === "all") {
          form.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => (box.checked = target.checked));
        }
        setSelected(form.querySelectorAll('input[name="ids"]:checked').length);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <div className={`flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-2.5 text-sm ${selected ? "bg-gold-light/30" : ""}`}>
        <span className="text-stone-600">{selected ? `${selected} selected` : "Tick members to act on several at once"}</span>
        <button type="submit" disabled={!selected || pending} className={`${buttonCls.success} !py-1.5`}>
          {pending ? "Approving…" : "Approve selected profiles"}
        </button>
        {state.error && <span role="alert" className="text-red-700">{state.error}</span>}
        {state.message && <span role="status" className="text-emerald-700">✓ {state.message}</span>}
      </div>
      {children}
    </form>
  );
}
