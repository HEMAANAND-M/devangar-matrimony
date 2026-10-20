"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReportResolution } from "@/app/actions/admin";
import { buttonCls, inputCls, selectCls } from "@/components/admin/ui";
import type { FormState } from "@/lib/form";

function Feedback({ result }: { result: FormState | null }) {
  if (result?.error) return <span role="alert" className="text-xs text-red-700">{result.error}</span>;
  if (result?.message) return <span role="status" className="text-xs text-emerald-700">✓ {result.message}</span>;
  return null;
}

/** Internal priority and notes; never shown to members. */
export function ReportNotes({
  action,
  priority: initialPriority,
  notes: initialNotes,
}: {
  action: (priority: number, notes: string) => Promise<FormState>;
  priority: number;
  notes: string;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState(initialPriority);
  const [notes, setNotes] = useState(initialNotes);
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = priority !== initialPriority || notes !== initialNotes;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-stone-600">
          Priority{" "}
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={`${selectCls} ml-1 !py-1`}>
            <option value={1}>High</option>
            <option value={2}>Normal</option>
            <option value={3}>Low</option>
          </select>
        </label>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Internal notes (staff only)"
        className={`${inputCls} w-full`}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !dirty}
          className={`${buttonCls.secondary} !py-1.5`}
          onClick={() =>
            startTransition(async () => {
              const r = await action(priority, notes);
              setResult(r);
              if (!r.error) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        <Feedback result={result} />
      </div>
    </div>
  );
}

export function ResolveReport({ action }: { action: (resolution: ReportResolution, note: string) => Promise<FormState> }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (resolution: ReportResolution) => {
    if (resolution === "remove" && !window.confirm("Remove this profile from the site? The member will see it as rejected.")) return;
    setResult(null);
    startTransition(async () => {
      const r = await action(resolution, note);
      setResult(r);
      if (!r.error) router.refresh();
    });
  };
  return (
    <div className="space-y-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Resolution note (required for a warning)" className={`${inputCls} w-full !py-1.5`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run("dismiss")} className={`${buttonCls.secondary} !py-1.5`}>Dismiss</button>
        <button type="button" disabled={pending} onClick={() => run("warn")} className={`${buttonCls.secondary} !py-1.5`}>Warn member</button>
        <button type="button" disabled={pending} onClick={() => run("remove")} className={`${buttonCls.danger} !py-1.5`}>Remove profile</button>
      </div>
      <Feedback result={result} />
    </div>
  );
}
