import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { link, notifyProfile } from "./notify";
import { extendPremium } from "./premium";

/** Indian financial year label for a date, e.g. "2026-27" (April to March). */
export function financialYear(d = new Date()): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * Next sequential invoice number for the financial year. GST rules require an unbroken series, so
 * a transaction-scoped advisory lock serialises allocation. Demo payments use their own series.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient, demo: boolean): Promise<string> {
  const prefix = `${demo ? "DEMO" : "DM"}/${financialYear()}/`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
  const last = await tx.payment.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const n = last?.invoiceNumber ? Number(last.invoiceNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(6, "0")}`;
}

/**
 * Marks a payment paid and extends the profile's premium membership exactly once, no matter how
 * many times it is called (checkout callback and webhook may both arrive). Also assigns the
 * invoice number and counts the coupon use.
 */
export async function activatePayment(paymentId: string, razorpayPaymentId?: string): Promise<boolean> {
  const activated = await db.$transaction(async (tx) => {
    // FAILED is claimable too: Razorpay can capture a payment after an earlier attempt failed.
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["CREATED", "FAILED"] } },
      data: { status: "PAID", paidAt: new Date(), failureReason: null, ...(razorpayPaymentId && { razorpayPaymentId }) },
    });
    if (claimed.count === 0) return null;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { profile: { select: { premiumUntil: true, name: true } } },
    });
    await tx.payment.update({ where: { id: paymentId }, data: { invoiceNumber: await nextInvoiceNumber(tx, payment.demo) } });
    if (payment.couponCode) {
      await tx.coupon.updateMany({ where: { code: payment.couponCode }, data: { uses: { increment: 1 } } });
    }
    if (!payment.profileId || !payment.profile) return { profileId: null, name: "", until: null };
    const until = extendPremium(payment.profile.premiumUntil, payment.months);
    await tx.profile.update({ where: { id: payment.profileId }, data: { premiumUntil: until } });
    return { profileId: payment.profileId, name: payment.profile.name, until };
  });
  if (!activated) return false;
  if (activated.profileId && activated.until) {
    await notifyProfile(activated.profileId, "premium_activated", {
      name: activated.name.split(" ")[0],
      until: activated.until.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      link: link("/upgrade"),
    });
  }
  return true;
}

/** GST-inclusive amount split into taxable value and 18% GST (CGST + SGST at 9% each). */
export function gstBreakdown(totalPaise: number) {
  const taxable = Math.round(totalPaise / 1.18);
  const gst = totalPaise - taxable;
  const cgst = Math.floor(gst / 2);
  return { taxable, gst, cgst, sgst: gst - cgst };
}
