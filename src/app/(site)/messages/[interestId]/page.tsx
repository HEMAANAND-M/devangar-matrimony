import Link from "next/link";
import { notFound } from "next/navigation";
import { blockFromForm, reportProfile } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { cardPhoto } from "@/components/ProfileCard";
import { TextArea } from "@/components/fields";
import { CHAT_BLOCK_TEXT, MESSAGE_MAX, loadConversation, markRead, toChatMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { getT, getTx } from "@/lib/i18n";
import { requireProfile } from "@/lib/session";
import { ChatThread } from "./ChatThread";
import { signedPhotoUrl } from "@/lib/photo-url";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ interestId: string }> }) {
  const { interestId } = await params;
  const { profile } = await requireProfile();
  const convo = await loadConversation(interestId, profile);
  if (!convo || convo.block === "blocked" || convo.block === "not_accepted") notFound();
  const { other, block } = convo;

  await markRead(interestId, profile.id);
  const recent = await db.message.findMany({ where: { interestId }, orderBy: { createdAt: "desc" }, take: 200 });
  const messages = recent.reverse().map((m) => toChatMessage(m, profile.id));
  const photo = cardPhoto(other, new Set([other.id]));
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const first = other.name.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline bg-cream/60 shadow-soft">
      <header className="flex items-center gap-3 border-b border-hairline bg-white px-3 py-3 sm:px-5">
        <Link href="/messages" className="rounded-full p-2 text-stone-500 transition hover:bg-sand hover:text-maroon" aria-label={t("chat.back")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <Link href={`/profiles/${other.code}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sand to-gold-light/60">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
              <img src={signedPhotoUrl(photo.id, "thumb")} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-lg text-gold-dark">{other.name.charAt(0)}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{other.name}</span>
            <span className="block text-xs text-stone-500">{other.code} · {other.city} · {t("chat.viewProfile")}</span>
          </span>
        </Link>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full p-2 text-stone-500 transition hover:bg-sand hover:text-maroon [&::-webkit-details-marker]:hidden" aria-label={t("chat.safetyOptions")}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-80 max-w-[85vw] space-y-4 rounded-2xl border border-hairline bg-white p-4 shadow-lift">
            <ActionForm action={reportProfile.bind(null, other.id)} className="space-y-2">
              <TextArea label={t("chat.reportLabel")} name="reason" required minLength={10} maxLength={1000} placeholder={t("chat.reportPlaceholder")} />
              <SubmitButton variant="secondary" className="w-full">{t("chat.sendReport")}</SubmitButton>
            </ActionForm>
            <ActionForm action={blockFromForm.bind(null, other.id)} confirm={t("chat.blockConfirm", { name: other.name })}>
              <SubmitButton variant="danger" className="w-full">{t("chat.block", { name: first })}</SubmitButton>
            </ActionForm>
          </div>
        </details>
      </header>

      {block && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 bg-gradient-to-r from-cream to-gold-light/30 px-5 py-3 text-sm text-stone-700">
          <p>{tx(CHAT_BLOCK_TEXT[block])}</p>
          {block === "premium" && (
            <Link href="/upgrade" className="rounded-full bg-maroon px-4 py-1.5 text-xs font-medium text-white shadow-soft hover:bg-maroon-dark">{t("chat.upgrade")}</Link>
          )}
        </div>
      )}

      <ChatThread
        interestId={interestId}
        initial={messages}
        canSend={!block}
        otherName={first}
        maxLength={MESSAGE_MAX}
        labels={{
          conversationWith: t("chat.conversationWith", { name: "{name}" }),
          read: t("chat.read"),
          sent: t("chat.sent"),
          safetyTip: t("chat.safetyTip"),
          message: t("chat.message"),
          messageTo: t("chat.messageTo", { name: "{name}" }),
          sending: t("chat.sending"),
          send: t("chat.send"),
          hint: t("chat.hint"),
          notSent: t("chat.notSent"),
        }}
      />
    </div>
  );
}
