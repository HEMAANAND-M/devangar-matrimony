import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { db } from "@/lib/db";
import { gstBreakdown } from "@/lib/payments";
import { planNames } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Invoice", robots: { index: false } };

const business = () => ({
  name: process.env.BUSINESS_NAME || "Devangar Matrimony",
  gstin: process.env.BUSINESS_GSTIN || "GSTIN not configured",
  address: process.env.BUSINESS_ADDRESS || "Business address not configured",
  email: process.env.BUSINESS_EMAIL || null,
});

const paise = (n: number) => `₹${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const payment = await db.payment.findUnique({
    where: { id },
    include: { profile: { select: { id: true, code: true, name: true, city: true, state: true } }, paidBy: { select: { id: true, phone: true } } },
  });
  // Visible to the payer, anyone managing the profile, and admins. Anyone else gets a 404.
  const allowed =
    !!payment &&
    (user.role === "ADMIN" || payment.paidById === user.id || (!!payment.profileId && payment.profileId === user.profile?.id));
  if (!payment || !allowed || !payment.invoiceNumber || !payment.paidAt) notFound();

  const names = await planNames();
  const biz = business();
  const gross = payment.amount + payment.discount;
  const tax = gstBreakdown(payment.amount);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`@media print { header, footer, .no-print { display: none !important; } main { padding: 0 !important; } body { background: #fff !important; } }`}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={user.role === "ADMIN" && payment.paidById !== user.id ? "/admin/payments" : "/upgrade"} className="text-sm text-stone-600 hover:text-maroon">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-hairline bg-white p-8 shadow-soft print:border-0 print:p-0 print:shadow-none sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-8">
          <div>
            <Logo />
            <p className="mt-4 text-sm font-medium text-ink">{biz.name}</p>
            <p className="max-w-xs whitespace-pre-line text-sm text-stone-600">{biz.address}</p>
            <p className="mt-1 text-sm text-stone-600">GSTIN: {biz.gstin}</p>
            {biz.email && <p className="text-sm text-stone-600">{biz.email}</p>}
          </div>
          <div className="text-right">
            <p className="eyebrow text-gold-dark">{payment.demo ? "Demo receipt" : "Tax invoice"}</p>
            <p className="mt-2 font-mono text-sm text-ink">{payment.invoiceNumber}</p>
            <p className="mt-1 text-sm text-stone-600">Date: {fmt(payment.paidAt)}</p>
            {payment.status === "REFUNDED" && (
              <p className="mt-2 inline-block rounded bg-sand px-2 py-0.5 text-xs font-medium text-stone-700">
                Refunded{payment.refundAmount != null && ` ${paise(payment.refundAmount)}`}
                {payment.refundedAt && ` on ${fmt(payment.refundedAt)}`}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 border-b border-hairline py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="eyebrow text-stone-500">Billed to</p>
            <p className="mt-2 font-medium text-ink">{payment.profile ? `${payment.profile.name} (${payment.profile.code})` : "Member (account deleted)"}</p>
            {payment.profile && <p className="text-stone-600">{payment.profile.city}, {payment.profile.state}</p>}
            {payment.paidBy && <p className="text-stone-600">{payment.paidBy.phone}</p>}
          </div>
          <div className="sm:text-right">
            <p className="eyebrow text-stone-500">Payment</p>
            <p className="mt-2 text-stone-600">{payment.offline ? "Offline payment" : payment.demo ? "Demo checkout (no charge)" : "Razorpay"}</p>
            {payment.razorpayPaymentId && <p className="font-mono text-xs text-stone-500">{payment.razorpayPaymentId}</p>}
            <p className="text-stone-600">Place of supply: {payment.profile?.state ?? "India"}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-stone-500">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">SAC</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            <tr>
              <td className="py-3">
                {names.get(payment.plan) ?? payment.plan} premium membership — {payment.months} months
              </td>
              <td className="py-3 text-stone-600">998439</td>
              <td className="py-3 text-right tabular-nums">{paise(gross)}</td>
            </tr>
            {payment.discount > 0 && (
              <tr>
                <td className="py-3 text-stone-600" colSpan={2}>Discount{payment.couponCode && ` (coupon ${payment.couponCode})`}</td>
                <td className="py-3 text-right tabular-nums text-emerald-700">−{paise(payment.discount)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-hairline pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-stone-600">Taxable value</dt><dd className="tabular-nums">{paise(tax.taxable)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-600">CGST @ 9%</dt><dd className="tabular-nums">{paise(tax.cgst)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-600">SGST @ 9%</dt><dd className="tabular-nums">{paise(tax.sgst)}</dd></div>
          <div className="flex justify-between border-t border-hairline pt-2 text-base font-semibold text-ink">
            <dt>Total (GST inclusive)</dt>
            <dd className="tabular-nums">{paise(payment.amount)}</dd>
          </div>
        </dl>

        <p className="mt-10 text-xs leading-relaxed text-stone-500">
          {payment.demo
            ? "This is a demo receipt generated without a real charge and is not a tax invoice."
            : "This is a computer-generated invoice and does not require a signature. For inter-state supplies the GST shown applies as IGST @ 18%."}
        </p>
      </article>
    </div>
  );
}
