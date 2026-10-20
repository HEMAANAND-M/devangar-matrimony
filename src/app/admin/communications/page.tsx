import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { deleteAnnouncement, resendNotification, saveAnnouncement, setAnnouncementActive } from "@/app/actions/admin-business";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import {
  AdminPageHeader, Badge, EmptyState, FilterBar, FilterField, Pagination, Panel, Table, Td,
  buttonCls, inputCls, label, selectCls, statusTone,
} from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateOnly, dateTime, maskPhone } from "@/lib/format";
import { TEMPLATES, whatsappConfigured } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Communications" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";
const AUDIENCES: Record<string, string> = {
  all: "Everyone", free: "Free members", premium: "Premium members", male: "Grooms", female: "Brides", staff: "Staff only",
};
const PAGE = 30;
const isoDate = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

type Params = { tab?: string; template?: string; status?: string; channel?: string; page?: string };

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const params = await searchParams;
  const tab = params.tab === "notifications" || params.tab === "templates" ? params.tab : "announcements";
  const tabs: [string, string][] = [["announcements", "Announcements"], ["notifications", "Message log"], ["templates", "Templates"]];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Communications"
        description={whatsappConfigured() ? "WhatsApp Cloud API is connected." : "WhatsApp is not connected — messages are recorded but not sent until WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set."}
      />
      <nav className="flex gap-1 border-b border-hairline" aria-label="Sections">
        {tabs.map(([key, text]) => (
          <Link
            key={key}
            href={`/admin/communications${key === "announcements" ? "" : `?tab=${key}`}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${tab === key ? "border-maroon font-medium text-maroon" : "border-transparent text-stone-600 hover:text-maroon"}`}
          >
            {text}
          </Link>
        ))}
      </nav>
      {tab === "announcements" && <Announcements />}
      {tab === "notifications" && <MessageLog params={params} />}
      {tab === "templates" && <Templates />}
    </div>
  );
}

function AnnouncementFields({ a }: { a?: Prisma.AnnouncementGetPayload<object> }) {
  const f = `${inputCls} mt-1 w-full`;
  return (
    <>
      <label className="block text-xs font-medium text-stone-600">
        Title
        <input name="title" required maxLength={120} defaultValue={a?.title} className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Message
        <textarea name="body" required maxLength={600} rows={3} defaultValue={a?.body} className={f} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-stone-600">
          Link (optional)
          <input name="href" defaultValue={a?.href ?? ""} placeholder="/events or https://…" className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Show to
          <select name="audience" defaultValue={a?.audience ?? "all"} className={`${selectCls} mt-1 w-full`}>
            {Object.entries(AUDIENCES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Starts
          <input type="date" name="startsAt" defaultValue={isoDate(a?.startsAt ?? null)} className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Ends (optional)
          <input type="date" name="endsAt" defaultValue={isoDate(a?.endsAt ?? null)} className={f} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="active" defaultChecked={a ? a.active : true} className="accent-maroon" /> Active
      </label>
    </>
  );
}

async function Announcements() {
  const list = await db.announcement.findMany({ orderBy: [{ active: "desc" }, { startsAt: "desc" }], take: 50 });
  const now = new Date();
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Panel title="New announcement" description="Shown as a banner at the top of member pages.">
        <ActionForm action={saveAnnouncement.bind(null, null)} className="space-y-3">
          <AnnouncementFields />
          <SubmitButton className={`${SUBMIT} w-full`}>Publish</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel title={`Announcements (${list.length})`}>
        {list.length ? (
          <ul className="divide-y divide-hairline">
            {list.map((a) => {
              const live = a.active && a.startsAt <= now && (!a.endsAt || a.endsAt > now);
              return (
                <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {a.title}
                        <Badge tone={live ? "green" : a.active ? "amber" : "neutral"}>{live ? "Live" : a.active ? "Scheduled / ended" : "Hidden"}</Badge>
                        <Badge tone="maroon">{AUDIENCES[a.audience] ?? a.audience}</Badge>
                      </p>
                      <p className="mt-1 text-sm text-stone-600">{a.body}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {dateOnly(a.startsAt)} → {a.endsAt ? dateOnly(a.endsAt) : "no end date"}
                        {a.href && ` · links to ${a.href}`}
                      </p>
                    </div>
                    <span className="flex gap-1">
                      <ActionButton variant="ghost" action={setAnnouncementActive.bind(null, a.id, !a.active)}>{a.active ? "Hide" : "Show"}</ActionButton>
                      <ActionButton variant="ghost" confirm="Delete this announcement?" action={deleteAnnouncement.bind(null, a.id)}>Delete</ActionButton>
                    </span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-maroon">Edit</summary>
                    <ActionForm action={saveAnnouncement.bind(null, a.id)} className="mt-3 space-y-3 rounded-lg bg-cream/50 p-4">
                      <AnnouncementFields a={a} />
                      <SubmitButton className={SUBMIT}>Save changes</SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No announcements">Use announcements for community events, festival offers or service updates.</EmptyState>
        )}
      </Panel>
    </div>
  );
}

const STATUSES = ["PENDING", "SENT", "FAILED", "NOT_CONFIGURED"] as const;
const CHANNELS = ["WHATSAPP", "SMS", "EMAIL"] as const;

async function MessageLog({ params }: { params: Params }) {
  const page = Math.max(1, Number(params.page) || 1);
  const status = STATUSES.find((s) => s === params.status);
  const channel = CHANNELS.find((c) => c === params.channel);
  const where: Prisma.NotificationWhereInput = {
    ...(params.template && { template: params.template }),
    ...(status && { status }),
    ...(channel && { channel }),
  };
  const [rows, total] = await Promise.all([
    db.notification.findMany({ where, include: { user: { select: { phone: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.notification.count({ where }),
  ]);
  return (
    <Panel flush title={`${total.toLocaleString("en-IN")} messages`}>
      <FilterBar resetHref="/admin/communications?tab=notifications">
        <input type="hidden" name="tab" value="notifications" />
        <FilterField label="Template">
          <select name="template" defaultValue={params.template ?? ""} className={selectCls}>
            <option value="">Any</option>
            {Object.keys(TEMPLATES).map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={params.status ?? ""} className={selectCls}>
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </FilterField>
        <FilterField label="Channel">
          <select name="channel" defaultValue={params.channel ?? ""} className={selectCls}>
            <option value="">Any</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c === "SMS" ? "SMS" : label(c)}</option>)}
          </select>
        </FilterField>
      </FilterBar>
      {rows.length ? (
        <Table head={["Sent", "Template", "Recipient", "Channel", "Status", ""]}>
          {rows.map((n) => (
            <tr key={n.id}>
              <Td className="whitespace-nowrap text-stone-600">{dateTime(n.createdAt)}</Td>
              <Td className="font-medium">{label(n.template)}</Td>
              <Td className="whitespace-nowrap tabular-nums text-stone-600">{maskPhone(n.user.phone)}</Td>
              <Td>{n.channel === "SMS" ? "SMS" : label(n.channel)}</Td>
              <Td>
                <Badge tone={statusTone(n.status)}>{label(n.status)}</Badge>
                {n.error && <span className="mt-1 block max-w-xs truncate text-xs text-red-700" title={n.error}>{n.error}</span>}
              </Td>
              <Td className="text-right">
                {(n.status === "FAILED" || n.status === "NOT_CONFIGURED") && (
                  <ActionButton variant="ghost" pendingLabel="Sending…" action={resendNotification.bind(null, n.id)}>Resend</ActionButton>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState title="No messages match these filters" />
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} params={params} basePath="/admin/communications" />
    </Panel>
  );
}

async function Templates() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const counts = await db.notification.groupBy({ by: ["template", "status"], where: { createdAt: { gte: since } }, _count: true });
  const count = (t: string, s?: string) => counts.filter((c) => c.template === t && (!s || c.status === s)).reduce((n, c) => n + c._count, 0);
  return (
    <Panel
      flush
      title="Message templates"
      description="Each template must be created and approved in Meta Business Manager with the same name, language and variables in this order."
      actions={<a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className={buttonCls.secondary}>Open WhatsApp Manager</a>}
    >
      <Table head={["Template name", "Variables", "Sent (30 days)", "Failed", "Not sent"]}>
        {Object.entries(TEMPLATES).map(([name, vars]) => (
          <tr key={name}>
            <Td className="font-mono text-xs font-medium">{name}</Td>
            <Td className="text-stone-600">{vars.map((v, i) => `{{${i + 1}}} ${v}`).join(", ")}</Td>
            <Td className="tabular-nums">{count(name, "SENT")}</Td>
            <Td className={`tabular-nums ${count(name, "FAILED") ? "text-red-700" : ""}`}>{count(name, "FAILED")}</Td>
            <Td className="tabular-nums text-stone-500">{count(name, "NOT_CONFIGURED")}</Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
