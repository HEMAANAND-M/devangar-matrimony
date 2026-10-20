import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AdminPageHeader, Badge, EmptyState, FilterBar, FilterField, Pagination, Panel, Table, Td, inputCls, label, statusTone } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Support inbox" };

const PAGE = 30;
const STATUSES = ["OPEN", "PENDING", "RESOLVED"] as const;

export default async function SupportInbox({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  // Open tickets first by default: that is the work queue.
  const status = params.status === "all" ? undefined : (STATUSES.find((s) => s === params.status) ?? "OPEN");
  const q = params.q?.trim();
  const where: Prisma.SupportTicketWhereInput = {
    ...(status && { status }),
    ...(q && { OR: [{ subject: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }),
  };
  const [tickets, total, counts] = await Promise.all([
    db.supportTicket.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, fromStaff: true, createdAt: true } },
        user: { select: { profile: { select: { code: true } } } },
      },
      orderBy: { updatedAt: status === "RESOLVED" ? "desc" : "asc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.supportTicket.count({ where }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const tabs: [string, string, number | null][] = [
    ["OPEN", "Open", countOf("OPEN")],
    ["PENDING", "Awaiting member", countOf("PENDING")],
    ["RESOLVED", "Resolved", countOf("RESOLVED")],
    ["all", "All", null],
  ];
  const current = params.status === "all" ? "all" : status;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Support inbox" description="Messages from the contact form and member help requests. Oldest open tickets are shown first." />
      <nav className="flex flex-wrap gap-1 border-b border-hairline" aria-label="Ticket status">
        {tabs.map(([key, text, n]) => (
          <Link
            key={key}
            href={`/admin/support?status=${key}`}
            aria-current={current === key ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition ${current === key ? "border-maroon font-medium text-maroon" : "border-transparent text-stone-600 hover:text-maroon"}`}
          >
            {text}
            {n !== null && <span className="rounded-full bg-sand px-1.5 text-xs tabular-nums text-stone-600">{n}</span>}
          </Link>
        ))}
      </nav>
      <Panel flush>
        <FilterBar resetHref={`/admin/support?status=${current}`}>
          <input type="hidden" name="status" value={current} />
          <FilterField label="Search">
            <input name="q" defaultValue={q} placeholder="Subject, name or email" className={`${inputCls} w-64`} />
          </FilterField>
        </FilterBar>
        {tickets.length ? (
          <Table head={["Subject", "From", "Last message", "Status", "Updated"]}>
            {tickets.map((t) => {
              const last = t.messages[0];
              return (
                <tr key={t.id} className="hover:bg-cream/40">
                  <Td>
                    <Link href={`/admin/support/${t.id}`} className="font-medium text-ink hover:text-maroon">{t.subject}</Link>
                    <span className="block text-xs text-stone-500">{t._count.messages} message{t._count.messages === 1 ? "" : "s"}</span>
                  </Td>
                  <Td>
                    {t.name}
                    <span className="block text-xs text-stone-500">{t.user?.profile?.code ?? (t.userId ? "Member" : "Visitor")}</span>
                  </Td>
                  <Td className="max-w-sm">
                    {last && (
                      <span className="line-clamp-2 text-stone-600">
                        {last.fromStaff && <span className="font-medium text-gold-dark">Staff: </span>}
                        {last.body}
                      </span>
                    )}
                  </Td>
                  <Td><Badge tone={statusTone(t.status)}>{t.status === "PENDING" ? "Awaiting member" : label(t.status)}</Badge></Td>
                  <Td className="whitespace-nowrap text-stone-600">{dateTime(t.updatedAt)}</Td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState title={current === "OPEN" ? "Inbox zero" : "No tickets here"}>{current === "OPEN" ? "Every member question has been answered." : undefined}</EmptyState>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PAGE)} params={params} basePath="/admin/support" />
      </Panel>
    </div>
  );
}
