import Link from "next/link";
import { refundPayment } from "@/app/actions/admin-business";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import {
  AdminPageHeader, Badge, EmptyState, FilterBar, FilterField, Pagination, Panel, StatCard, Table, Td,
  buttonCls, inputCls, label, selectCls, statusTone,
} from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { getPlans, planNames } from "@/lib/plans";
import { rupees } from "@/lib/premium";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireAdmin } from "@/lib/session";
import { type PaymentFilters, paymentWhere } from "./filters";

export const metadata = { title: "Payments" };

const PAGE = 25;
const SUBMIT = "!rounded-lg !px-3.5 !py-2 !tracking-normal !shadow-none";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<PaymentFilters & { page?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = paymentWhere(params);

  const [plans, names, rows, total, paid, refunded, failed, failedRecent] = await Promise.all([
    getPlans({ includeInactive: true }),
    planNames(),
    db.payment.findMany({
      where,
      include: { profile: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where: { AND: [where, { status: { in: ["PAID", "REFUNDED"] }, demo: false }] }, _sum: { amount: true, discount: true }, _count: true }),
    db.payment.aggregate({ where: { AND: [where, { status: "REFUNDED" }] }, _sum: { refundAmount: true }, _count: true }),
    db.payment.count({ where: { AND: [where, { status: "FAILED" }] } }),
    params.status ? Promise.resolve([]) : db.payment.findMany({
      where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      include: { profile: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const gross = paid._sum.amount ?? 0;
  const net = gross - (refunded._sum.refundAmount ?? 0);
  const exportQs = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== "page" && v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payments"
        description={razorpayConfigured() ? "Razorpay is live. Refunds are sent to Razorpay automatically." : "Demo mode — Razorpay keys are not configured. Refunds are recorded only."}
        actions={
          <a href={`/api/admin/export/payments${exportQs ? `?${exportQs}` : ""}`} className={buttonCls.secondary}>
            Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected" value={rupees(gross)} hint={`${paid._count} paid orders · excl. demo`} />
        <StatCard label="Net of refunds" value={rupees(net)} hint={`${refunded._count} refunded · ${rupees(refunded._sum.refundAmount ?? 0)}`} />
        <StatCard label="Coupon discounts" value={rupees(paid._sum.discount ?? 0)} />
        <StatCard label="Failed" value={failed} tone={failed ? "attention" : "neutral"} href="/admin/payments?status=FAILED" hint="In the selected range" />
      </div>

      {failedRecent.length > 0 && (
        <Panel title="Recent failed payments" description="Last 30 days. Members may need help completing payment." actions={<Link href="/admin/payments?status=FAILED" className={buttonCls.ghost}>View all</Link>}>
          <ul className="divide-y divide-hairline text-sm">
            {failedRecent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {p.profile ? <Link href={`/profiles/${p.profile.code}`} className="font-medium text-maroon hover:underline">{p.profile.name} ({p.profile.code})</Link> : "Deleted account"}
                  <span className="text-stone-500"> · {names.get(p.plan) ?? p.plan} · {rupees(p.amount)}</span>
                </span>
                <span className="text-xs text-stone-500">{p.failureReason ?? "No reason given"} · {dateTime(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel flush title={`${total.toLocaleString("en-IN")} payment${total === 1 ? "" : "s"}`}>
        <FilterBar resetHref="/admin/payments">
          <FilterField label="Search">
            <input name="q" defaultValue={params.q} placeholder="Invoice, profile ID, name, coupon" className={`${inputCls} w-56`} />
          </FilterField>
          <FilterField label="Status">
            <select name="status" defaultValue={params.status ?? ""} className={selectCls}>
              <option value="">Any</option>
              {["PAID", "FAILED", "REFUNDED", "CREATED"].map((s) => <option key={s} value={s}>{s === "CREATED" ? "Started" : label(s)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Plan">
            <select name="plan" defaultValue={params.plan ?? ""} className={selectCls}>
              <option value="">Any</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.months}m)</option>)}
            </select>
          </FilterField>
          <FilterField label="Type">
            <select name="kind" defaultValue={params.kind ?? ""} className={selectCls}>
              <option value="">Any</option>
              <option value="online">Online</option>
              <option value="offline">Offline / granted</option>
              <option value="demo">Demo</option>
            </select>
          </FilterField>
          <FilterField label="From"><input type="date" name="from" defaultValue={params.from} className={inputCls} /></FilterField>
          <FilterField label="To"><input type="date" name="to" defaultValue={params.to} className={inputCls} /></FilterField>
        </FilterBar>

        {rows.length ? (
          <Table head={["Date", "Member", "Plan", "Amount", "Status", "Invoice", ""]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-cream/40">
                <Td className="whitespace-nowrap text-stone-600">{dateTime(p.paidAt ?? p.createdAt)}</Td>
                <Td>
                  {p.profile ? (
                    <Link href={`/profiles/${p.profile.code}`} className="font-medium text-ink hover:text-maroon">
                      {p.profile.name} <span className="text-stone-500">{p.profile.code}</span>
                    </Link>
                  ) : (
                    <span className="text-stone-500">Deleted account</span>
                  )}
                </Td>
                <Td>
                  {names.get(p.plan) ?? p.plan} <span className="text-stone-500">· {p.months}m</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {p.demo && <Badge>demo</Badge>}
                    {p.offline && <Badge tone="blue">offline</Badge>}
                    {p.couponCode && <Badge tone="gold">{p.couponCode}</Badge>}
                  </span>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {rupees(p.amount)}
                  {p.discount > 0 && <span className="block text-xs text-stone-500">−{rupees(p.discount)} discount</span>}
                  {p.refundAmount != null && <span className="block text-xs text-red-700">−{rupees(p.refundAmount)} refunded</span>}
                </Td>
                <Td>
                  <Badge tone={statusTone(p.status)}>{p.status === "CREATED" ? "Started" : label(p.status)}</Badge>
                  {p.failureReason && <span className="mt-1 block max-w-[14rem] text-xs text-stone-500">{p.failureReason}</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  {p.invoiceNumber ? (
                    <Link href={`/invoices/${p.id}`} className="font-mono text-xs text-maroon hover:underline">{p.invoiceNumber}</Link>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  {p.status === "PAID" && (
                    <details className="group relative inline-block text-left">
                      <summary className={`${buttonCls.ghost} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Refund</summary>
                      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-hairline bg-white p-4 shadow-lift">
                        <ActionForm action={refundPayment.bind(null, p.id)} confirm="Issue this refund? This cannot be undone." className="space-y-3">
                          <label className="block text-xs font-medium text-stone-600">
                            Amount (₹) — leave blank for full {rupees(p.amount)}
                            <input name="amount" inputMode="decimal" placeholder={String(p.amount / 100)} className={`${inputCls} mt-1 w-full`} />
                          </label>
                          <label className="flex items-center gap-2 text-sm text-stone-700">
                            <input type="checkbox" name="revoke" className="accent-maroon" /> Also remove {p.months} months of premium
                          </label>
                          <SubmitButton variant="danger" className={`${SUBMIT} w-full`}>Refund payment</SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No payments match these filters">Try widening the date range or clearing filters.</EmptyState>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PAGE)} params={params} basePath="/admin/payments" />
      </Panel>
    </div>
  );
}
