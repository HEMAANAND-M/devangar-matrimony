import Link from "next/link";
import { notFound } from "next/navigation";
import { setTicketStatus, staffReply } from "@/app/actions/support";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, Panel, inputCls, label, selectCls, statusTone } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime, maskPhone } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Support ticket" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { phone: true, role: true } } } },
      user: { select: { phone: true, profile: { select: { code: true, name: true } } } },
    },
  });
  if (!ticket) notFound();
  // Moderators do not see full member phone numbers.
  const phone = ticket.phone && (staff.role === "ADMIN" ? ticket.phone : maskPhone(ticket.phone));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[["/admin/support", "Support inbox"]]}
        title={ticket.subject}
        description={<>Opened {dateTime(ticket.createdAt)} · <Badge tone={statusTone(ticket.status)}>{ticket.status === "PENDING" ? "Awaiting member" : label(ticket.status)}</Badge></>}
        actions={
          <>
            {ticket.status !== "RESOLVED" && <ActionButton variant="success" action={setTicketStatus.bind(null, ticket.id, "RESOLVED")}>Mark resolved</ActionButton>}
            {ticket.status === "RESOLVED" && <ActionButton action={setTicketStatus.bind(null, ticket.id, "OPEN")}>Re-open</ActionButton>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Panel title="Conversation">
            <ol className="space-y-4">
              {ticket.messages.map((m) => (
                <li key={m.id} className={`flex ${m.fromStaff ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.fromStaff ? "bg-maroon/5 ring-1 ring-maroon/10" : "bg-cream ring-1 ring-hairline"}`}>
                    <p className="mb-1 text-xs text-stone-500">
                      <span className="font-medium text-ink">{m.fromStaff ? `Staff${m.author ? ` · ${maskPhone(m.author.phone)}` : ""}` : ticket.name}</span> · {dateTime(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed text-stone-800">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Reply">
            <ActionForm action={staffReply.bind(null, ticket.id)} className="space-y-3">
              <textarea name="message" required rows={5} maxLength={4000} placeholder="Write your reply…" className={`${inputCls} w-full`} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  After sending
                  <select name="status" defaultValue="PENDING" className={selectCls}>
                    <option value="PENDING">Wait for member</option>
                    <option value="RESOLVED">Mark resolved</option>
                  </select>
                </label>
                <SubmitButton className={SUBMIT}>Send reply</SubmitButton>
              </div>
              <p className="text-xs text-stone-500">
                {ticket.user?.profile
                  ? "The member is notified by WhatsApp/email (if opted in) and sees the reply under Support."
                  : "This sender has no member profile, so they are not notified automatically — contact them directly as well."}
              </p>
            </ActionForm>
          </Panel>
        </div>
        <Panel title="Contact">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-stone-500">Name</dt><dd className="font-medium">{ticket.name}</dd></div>
            {ticket.user?.profile && (
              <div>
                <dt className="text-xs text-stone-500">Profile</dt>
                <dd><Link href={`/profiles/${ticket.user.profile.code}`} className="text-maroon hover:underline">{ticket.user.profile.name} ({ticket.user.profile.code})</Link></dd>
              </div>
            )}
            {phone && <div><dt className="text-xs text-stone-500">Mobile</dt><dd className="tabular-nums">{phone}</dd></div>}
            {ticket.email && (
              <div><dt className="text-xs text-stone-500">Email</dt><dd><a href={`mailto:${ticket.email}`} className="text-maroon hover:underline">{ticket.email}</a></dd></div>
            )}
            <div><dt className="text-xs text-stone-500">Type</dt><dd>{ticket.userId ? "Signed-in member" : "Contact form (signed out)"}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
