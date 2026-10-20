import "server-only";
import { db } from "./db";
import { extendPremium } from "./premium";

/**
 * Marks a payment paid and extends the profile's premium membership exactly once, no matter how
 * many times it is called (checkout callback and webhook may both arrive).
 */
export async function activatePayment(paymentId: string, razorpayPaymentId?: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date(), ...(razorpayPaymentId && { razorpayPaymentId }) },
    });
    if (claimed.count === 0) return false;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { profile: { select: { premiumUntil: true } } } });
    if (!payment.profileId || !payment.profile) return true;
    await tx.profile.update({
      where: { id: payment.profileId },
      data: { premiumUntil: extendPremium(payment.profile.premiumUntil, payment.months) },
    });
    return true;
  });
}
