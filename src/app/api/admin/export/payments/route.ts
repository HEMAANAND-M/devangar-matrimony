import { paymentWhere } from "@/app/admin/payments/filters";
import { db } from "@/lib/db";
import { planNames } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";

const cell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Quote everything and neutralise spreadsheet formulas (CSV injection).
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`;
};

/** CSV of the payments matching the admin page's filters. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const [names, rows] = await Promise.all([
    planNames(),
    db.payment.findMany({
      where: paymentWhere(params),
      include: { profile: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20_000,
    }),
  ]);
  const header = ["Created", "Paid", "Invoice", "Profile", "Name", "Plan", "Months", "Amount (INR)", "Discount (INR)", "Coupon", "Status", "Type", "Razorpay payment", "Refunded (INR)", "Refunded at", "Failure reason"];
  const lines = rows.map((p) =>
    [
      p.createdAt, p.paidAt, p.invoiceNumber, p.profile?.code, p.profile?.name, names.get(p.plan) ?? p.plan, p.months,
      (p.amount / 100).toFixed(2), (p.discount / 100).toFixed(2), p.couponCode, p.status,
      p.demo ? "demo" : p.offline ? "offline" : "online", p.razorpayPaymentId,
      p.refundAmount != null ? (p.refundAmount / 100).toFixed(2) : "", p.refundedAt, p.failureReason,
    ].map(cell).join(","),
  );
  await db.adminLog.create({ data: { adminId: user.id, action: "export.payments", targetId: "payments", detail: `${rows.length} rows` } });
  return new Response(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
