import Link from "next/link";
import { notFound } from "next/navigation";
import { replyToTicket, setTicketStatus } from "@/app/actions/support";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { TextArea } from "@/components/fields";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Support request", robots: { index: false } };

export default async function MemberTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!ticket || ticket.userId !== user.id) notFound();
  const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const resolve = setTicketStatus.bind(null, ticket.id, "RESOLVED");
  const t = await getT();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/support" className="text-sm text-stone-600 hover:text-maroon">{t("ticket.all")}</Link>
      <PageHeader eyebrow={t(ticket.status === "RESOLVED" ? "support.status.RESOLVED" : ticket.status === "PENDING" ? "support.status.PENDING" : "support.status.OPEN")} title={ticket.subject} />
      <ol className="space-y-4">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`flex ${m.fromStaff ? "" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-soft ${m.fromStaff ? "border border-gold/40 bg-white" : "bg-maroon text-white"}`}>
              <p className={`mb-1 text-xs ${m.fromStaff ? "text-gold-dark" : "text-white/70"}`}>
                {t(m.fromStaff ? "ticket.support" : "ticket.you")} · {fmt(m.createdAt)}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Card className="mt-8" title={t(ticket.status === "RESOLVED" ? "ticket.moreHelp" : "ticket.reply")}>
        <ActionForm action={replyToTicket.bind(null, ticket.id)} className="space-y-4">
          <TextArea label={t("ticket.message")} name="message" required rows={4} maxLength={4000} />
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>{t(ticket.status === "RESOLVED" ? "ticket.reopen" : "ticket.send")}</SubmitButton>
          </div>
        </ActionForm>
        {ticket.status !== "RESOLVED" && (
          <form action={async () => { "use server"; await resolve(); }} className="mt-4 border-t border-hairline pt-4">
            <button className="text-sm text-stone-600 underline decoration-gold/50 underline-offset-4 hover:text-maroon">{t("ticket.close")}</button>
          </form>
        )}
      </Card>
    </div>
  );
}
