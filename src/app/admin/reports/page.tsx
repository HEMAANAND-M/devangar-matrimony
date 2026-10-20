import Link from "next/link";
import type { Prisma, ReportCategory } from "@prisma/client";
import { resolveReport, updateReport } from "@/app/actions/admin";
import { Tabs, waited } from "@/app/admin/approvals/_components/shared";
import { AdminPageHeader, Badge, EmptyState, FilterBar, FilterField, Pagination, Panel, type Tone, label, selectCls, statusTone } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime, maskPhone } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { ReportNotes, ResolveReport } from "./ReportControls";

export const metadata = { title: "Reports" };

const CATEGORIES: ReportCategory[] = ["FAKE_PROFILE", "HARASSMENT", "ALREADY_MARRIED", "ASKED_FOR_MONEY", "INAPPROPRIATE_CONTENT", "OTHER"];
const PRIORITY: Record<number, [string, Tone]> = { 1: ["High", "red"], 2: ["Normal", "amber"], 3: ["Low", "neutral"] };
const PAGE = 20;

type Search = { status?: string; category?: string; page?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const params = await searchParams;
  const resolved = params.status === "resolved";
  const category = CATEGORIES.includes(params.category as ReportCategory) ? (params.category as ReportCategory) : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.ReportWhereInput = { resolved, ...(category ? { category } : {}) };
  const [reports, total, openCount, resolvedCount] = await Promise.all([
    db.report.findMany({
      where,
      include: {
        reporter: { select: { code: true, name: true } },
        target: { select: { id: true, code: true, name: true, status: true, userId: true, flags: true } },
      },
      orderBy: resolved ? [{ resolvedAt: "desc" }] : [{ priority: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.report.count({ where }),
    db.report.count({ where: { resolved: false } }),
    db.report.count({ where: { resolved: true } }),
  ]);
  const targetIds = [...new Set(reports.map((r) => r.targetId))];
  const [counts, resolvers] = await Promise.all([
    db.report.groupBy({ by: ["targetId"], where: { targetId: { in: targetIds } }, _count: true }),
    db.user.findMany({ where: { id: { in: reports.map((r) => r.resolvedById).filter((x): x is string => !!x) } }, select: { id: true, phone: true } }),
  ]);
  const countFor = new Map(counts.map((c) => [c.targetId, c._count]));
  const resolverPhone = new Map(resolvers.map((u) => [u.id, u.phone]));
  const tabHref = (status: string) => `/admin/reports?status=${status}${category ? `&category=${category}` : ""}`;

  return (
    <div>
      <AdminPageHeader title="Reports" description="Member reports about other profiles. High-priority and older reports are listed first." />
      <Tabs
        active={resolved ? "resolved" : "open"}
        tabs={[
          { key: "open", label: "Open", count: openCount, href: tabHref("open") },
          { key: "resolved", label: "Resolved", count: resolvedCount, href: tabHref("resolved") },
        ]}
      />
      <Panel flush>
        <FilterBar resetHref={`/admin/reports${resolved ? "?status=resolved" : ""}`}>
          <input type="hidden" name="status" value={resolved ? "resolved" : "open"} />
          <FilterField label="Category">
            <select name="category" defaultValue={category ?? ""} className={selectCls}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </FilterField>
        </FilterBar>
        {reports.length ? (
          <ul className="divide-y divide-hairline">
            {reports.map((r) => {
              const [prioLabel, prioTone] = PRIORITY[r.priority] ?? PRIORITY[2];
              const reportsAgainst = countFor.get(r.targetId) ?? 1;
              return (
                <li key={r.id} className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!resolved && <Badge tone={prioTone}>{prioLabel} priority</Badge>}
                      <Badge tone="maroon">{label(r.category)}</Badge>
                      <span className="text-xs text-stone-500">{dateTime(r.createdAt)} · {waited(r.createdAt)} ago</span>
                    </div>
                    <div className="text-sm">
                      <p>
                        <span className="text-stone-500">Against </span>
                        <Link href={`/admin/members/${r.target.userId}`} className="font-semibold text-ink hover:text-maroon">{r.target.name} ({r.target.code})</Link>{" "}
                        <Badge tone={statusTone(r.target.status)}>{label(r.target.status)}</Badge>{" "}
                        {reportsAgainst > 1 && <Badge tone="red">{reportsAgainst} reports in total</Badge>}
                      </p>
                      <p className="mt-0.5 text-stone-500">
                        Reported by <Link href={`/profiles/${r.reporter.code}`} className="hover:text-maroon">{r.reporter.name} ({r.reporter.code})</Link>
                      </p>
                    </div>
                    <blockquote className="whitespace-pre-line rounded-lg border-l-2 border-gold bg-cream/60 px-4 py-2.5 text-sm text-ink">{r.reason}</blockquote>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Link href={`/profiles/${r.target.code}`} target="_blank" className="text-maroon underline decoration-gold/50 underline-offset-4">View profile ↗</Link>
                      <Link href={`/admin/members/${r.target.userId}`} className="text-maroon underline decoration-gold/50 underline-offset-4">Member record (suspend / ban)</Link>
                    </div>
                    {resolved && (
                      <p className="text-sm text-stone-600">
                        <span className="font-medium text-ink">{r.resolution ?? "Resolved"}</span>
                        {r.resolvedAt && <> · {dateTime(r.resolvedAt)}</>}
                        {r.resolvedById && resolverPhone.get(r.resolvedById) && <> · {maskPhone(resolverPhone.get(r.resolvedById)!)}</>}
                      </p>
                    )}
                  </div>
                  <div className="space-y-4">
                    <ReportNotes action={updateReport.bind(null, r.id)} priority={r.priority} notes={r.notes ?? ""} />
                    {!resolved && (
                      <div className="border-t border-hairline pt-4">
                        <ResolveReport action={resolveReport.bind(null, r.id)} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={resolved ? "No resolved reports" : "No open reports"}>
            {resolved ? "Resolved reports will be listed here." : "When members report a profile, it appears here."}
          </EmptyState>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PAGE)} params={params} basePath="/admin/reports" />
      </Panel>
    </div>
  );
}
