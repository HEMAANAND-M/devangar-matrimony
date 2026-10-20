import Link from "next/link";
import { AdminPageHeader, EmptyState, FilterBar, FilterField, Pagination, Panel, Table, Td, buttonCls, inputCls, label, selectCls } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime, maskPhone } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ACTION_GROUPS, actionLabel } from "./labels";
import { type ActivityParams, activityWhere, resolveTargets } from "./query";

export const metadata = { title: "Activity log" };
const PER_PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<ActivityParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = activityWhere(params);

  const [entries, total, staff] = await Promise.all([
    db.adminLog.findMany({
      where,
      include: { admin: { select: { phone: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.adminLog.count({ where }),
    db.user.findMany({ where: { OR: [{ role: { in: ["ADMIN", "MODERATOR"] } }, { adminLogs: { some: {} } }] }, select: { id: true, phone: true, role: true } }),
  ]);
  const targets = await resolveTargets(entries.map((e) => e.targetId));
  const exportQuery = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (k === "page" || !v ? [] : [[k, String(v)]])));

  return (
    <div>
      <AdminPageHeader
        title="Activity log"
        description="Every moderation, account and staff action, with who did it and when."
        actions={<a href={`/api/admin/export/activity?${exportQuery}`} className={buttonCls.secondary}>Export CSV</a>}
      />
      <Panel flush>
        <FilterBar resetHref="/admin/activity">
          <FilterField label="Staff member">
            <select name="staff" defaultValue={String(params.staff ?? "")} className={selectCls}>
              <option value="">Anyone</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{maskPhone(s.phone)} · {label(s.role)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Type">
            <select name="group" defaultValue={String(params.group ?? "")} className={selectCls}>
              <option value="">All actions</option>
              {ACTION_GROUPS.map(([prefix, text]) => <option key={prefix} value={prefix}>{text}</option>)}
            </select>
          </FilterField>
          <FilterField label="From"><input type="date" name="from" defaultValue={String(params.from ?? "")} className={inputCls} /></FilterField>
          <FilterField label="To"><input type="date" name="to" defaultValue={String(params.to ?? "")} className={inputCls} /></FilterField>
          <FilterField label="Target or detail"><input name="q" defaultValue={String(params.q ?? "")} placeholder="ID or text" className={inputCls} /></FilterField>
        </FilterBar>
        {entries.length ? (
          <Table head={["When", "Staff", "Action", "Member", "Detail"]}>
            {entries.map((e) => {
              const t = targets.get(e.targetId);
              return (
                <tr key={e.id} className="hover:bg-cream/40">
                  <Td className="whitespace-nowrap text-stone-600">{dateTime(e.createdAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {maskPhone(e.admin.phone)}
                    <span className="ml-1.5 text-xs text-stone-500">{label(e.admin.role)}</span>
                  </Td>
                  <Td className="font-medium text-ink">{actionLabel(e.action)}</Td>
                  <Td>
                    {t ? (
                      <Link href={`/admin/members/${t.userId}`} className="text-maroon hover:underline">
                        {t.name ?? "Account"}{t.code && <span className="ml-1 text-xs text-stone-500">{t.code}</span>}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-stone-400">{e.targetId.slice(0, 12)}</span>
                    )}
                  </Td>
                  <Td className="max-w-xs text-stone-600"><span className="line-clamp-2">{e.detail ?? "—"}</span></Td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState title="No matching activity">Try widening the date range or clearing filters.</EmptyState>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} params={params} basePath="/admin/activity" />
      </Panel>
    </div>
  );
}
