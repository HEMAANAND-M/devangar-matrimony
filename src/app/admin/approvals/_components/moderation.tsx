"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonCls, inputCls } from "@/components/admin/ui";
import type { FormState } from "@/lib/form";

function Feedback({ result }: { result: FormState | null }) {
  if (result?.error) return <p role="alert" className="text-xs text-red-700">{result.error}</p>;
  if (result?.message) return <p role="status" className="text-xs text-emerald-700">✓ {result.message}</p>;
  return null;
}

/**
 * Reason picker for rejections: canned reasons as chips that fill the text box, plus free text.
 * `onDone` runs after a successful rejection (e.g. move to the next item).
 */
export function RejectForm({
  action,
  reasons,
  inputId,
  compact = false,
  label = "Reject",
  onDoneHref,
}: {
  action: (reason: string) => Promise<FormState>;
  reasons: string[];
  inputId?: string;
  compact?: boolean;
  label?: string;
  onDoneHref?: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const r = await action(reason);
      setResult(r);
      if (!r.error) {
        setReason("");
        if (onDoneHref) router.replace(onDoneHref);
        router.refresh();
      }
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              reason === r ? "border-maroon bg-maroon/5 text-maroon" : "border-hairline text-stone-600 hover:border-gold hover:text-maroon"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className={compact ? "flex gap-2" : "space-y-2"}>
        {compact ? (
          <input
            id={inputId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              // Inside a bulk-select form, Enter must not submit that form.
              if (e.key === "Enter") {
                e.preventDefault();
                if (reason.trim()) submit();
              }
            }}
            placeholder="Reason" maxLength={300} className={`${inputCls} min-w-0 flex-1 !py-1.5`} />
        ) : (
          <textarea
            id={inputId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason shown to the member"
            maxLength={300}
            rows={2}
            className={`${inputCls} w-full`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
        )}
        <button type="button" disabled={pending || !reason.trim()} onClick={submit} className={`${buttonCls.danger} ${compact ? "!py-1.5" : "w-full"}`}>
          {pending ? "Rejecting…" : label}
        </button>
      </div>
      <Feedback result={result} />
    </div>
  );
}

/** Approve button that moves to the next item on success. */
export function ApproveButton({
  action,
  nextHref,
  label = "Approve",
  id,
  className = "",
}: {
  action: () => Promise<FormState>;
  nextHref?: string;
  label?: string;
  id?: string;
  className?: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <button
        id={id}
        type="button"
        disabled={pending}
        className={`${buttonCls.success} ${className}`}
        onClick={() =>
          startTransition(async () => {
            const r = await action();
            setResult(r);
            if (!r.error) {
              if (nextHref) router.replace(nextHref);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Approving…" : label}
      </button>
      <Feedback result={result} />
    </div>
  );
}

/**
 * Keyboard shortcuts for the one-at-a-time review screen. Ignored while typing in a field.
 */
export function ReviewShortcuts({ prevHref, nextHref, approveId, rejectInputId }: { prevHref?: string; nextHref?: string; approveId: string; rejectInputId: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
        if (e.key === "Escape") t.blur();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        document.getElementById(approveId)?.click();
      } else if (key === "r") {
        e.preventDefault();
        document.getElementById(rejectInputId)?.focus();
      } else if ((key === "j" || e.key === "ArrowRight") && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      } else if ((key === "k" || e.key === "ArrowLeft") && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref, approveId, rejectInputId]);

  const Key = ({ children }: { children: React.ReactNode }) => (
    <kbd className="rounded border border-hairline bg-white px-1.5 py-0.5 font-sans text-[0.7rem] font-semibold text-ink shadow-[0_1px_0_rgb(0_0_0/0.08)]">{children}</kbd>
  );
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500" aria-label="Keyboard shortcuts">
      <span><Key>A</Key> approve</span>
      <span><Key>R</Key> reject reason</span>
      <span><Key>J</Key>/<Key>→</Key> next</span>
      <span><Key>K</Key>/<Key>←</Key> previous</span>
      <span><Key>Ctrl</Key>+<Key>Enter</Key> send rejection</span>
    </p>
  );
}

/** "Select all" checkbox for checkboxes named `ids` inside the given form. */
export function SelectAll({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="h-4 w-4 accent-maroon"
      onChange={(e) => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.target.checked));
      }}
    />
  );
}

/** Runs a bulk action on the checked `ids` checkboxes of a form. */
export function BulkAction({ formId, action, label }: { formId: string; action: (ids: string[]) => Promise<FormState>; label: string }) {
  const router = useRouter();
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={buttonCls.success}
        onClick={() => {
          const form = document.getElementById(formId) as HTMLFormElement | null;
          const ids = form ? new FormData(form).getAll("ids").map(String) : [];
          if (!ids.length) {
            setResult({ error: "Select at least one item." });
            return;
          }
          startTransition(async () => {
            const r = await action(ids);
            setResult(r);
            router.refresh();
          });
        }}
      >
        {pending ? "Working…" : label}
      </button>
      <Feedback result={result} />
    </span>
  );
}
