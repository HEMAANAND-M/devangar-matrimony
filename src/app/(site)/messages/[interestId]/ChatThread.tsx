"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/actions/messages";
import type { ChatMessage } from "@/lib/chat";

const POLL_MS = 6000;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function ChatThread({
  interestId,
  initial,
  canSend,
  otherName,
  maxLength,
}: {
  interestId: string;
  initial: ChatMessage[];
  canSend: boolean;
  otherName: string;
  maxLength: number;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef(initial.at(-1)?.createdAt ?? null);

  const merge = useCallback((incoming: ChatMessage[], readUpTo?: string | null) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))].map((m) =>
        readUpTo && m.mine && !m.read && m.createdAt <= readUpTo ? { ...m, read: true } : m,
      );
      latest.current = next.at(-1)?.createdAt ?? latest.current;
      return next;
    });
  }, []);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const q = latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
        const res = await fetch(`/api/messages/${interestId}${q}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data: { messages: ChatMessage[]; readUpTo: string | null } = await res.json();
        merge(data.messages, data.readUpTo);
      } catch {
        // Offline or a transient error: the next tick retries.
      }
    };
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [interestId, merge]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    // Cleared now rather than on success, so anything typed while sending is not wiped.
    setDraft("");
    startTransition(async () => {
      const result = await sendMessage(interestId, body).catch(() => ({ error: "Message not sent. Check your connection and try again." }) as const);
      if ("sent" in result && result.sent) merge([result.sent]);
      if (result.error) {
        setError(result.error);
        setDraft((current) => current || body);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[50vh] flex-1 space-y-2 overflow-y-auto px-3 py-5 sm:px-6" aria-live="polite" aria-label={`Conversation with ${otherName}`}>
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-stone-500">
            No messages yet. Start with a warm introduction — about yourself or your family.
          </p>
        )}
        {messages.map((m, i) => {
          const newDay = i === 0 || day(messages[i - 1].createdAt) !== day(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && (
                <p className="my-4 text-center text-[0.7rem] font-medium uppercase tracking-wider text-stone-400" suppressHydrationWarning>
                  {day(m.createdAt)}
                </p>
              )}
              <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[70%] ${
                    m.mine ? "rounded-br-md bg-maroon text-white" : "rounded-bl-md border border-hairline bg-white text-ink"
                  }`}
                >
                  {m.body}
                  <span className={`mt-1 flex items-center justify-end gap-1 text-[0.65rem] ${m.mine ? "text-white/70" : "text-stone-400"}`} suppressHydrationWarning>
                    {time(m.createdAt)}
                    {m.mine && <span aria-label={m.read ? "Read" : "Sent"}>{m.read ? "✓✓" : "✓"}</span>}
                  </span>
                </div>
                {m.warning && (
                  <p role="note" className="mt-1 max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                    Safety tip: never send money, gifts or bank details to someone you have not met. Report anything suspicious.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {canSend && (
        <form
          className="sticky bottom-0 border-t border-hairline bg-white/95 p-3 backdrop-blur sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-800">{error}</p>}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="chat-draft">Message</label>
            <textarea
              id="chat-draft"
              rows={1}
              value={draft}
              maxLength={maxLength}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`Message ${otherName}`}
              className="max-h-40 min-h-[44px] flex-1 resize-y rounded-2xl border border-hairline bg-cream/40 px-4 py-2.5 text-sm focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-gold/15"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="h-11 shrink-0 rounded-full bg-maroon px-5 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="mt-1.5 text-[0.7rem] text-stone-400">Enter to send · Shift+Enter for a new line · Never send money to anyone you meet online.</p>
        </form>
      )}
    </div>
  );
}
