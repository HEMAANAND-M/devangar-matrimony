import type { Prisma } from "@prisma/client";

export type PaymentFilters = { status?: string; plan?: string; from?: string; to?: string; kind?: string; q?: string };

const STATUSES = ["CREATED", "PAID", "FAILED", "REFUNDED"] as const;

/** Shared by the payments page and its CSV export so both show the same rows. */
export function paymentWhere(f: PaymentFilters): Prisma.PaymentWhereInput {
  const status = STATUSES.find((s) => s === f.status);
  const dateField = status === "PAID" || status === "REFUNDED" ? "paidAt" : "createdAt";
  const range = {
    ...(f.from && { gte: new Date(`${f.from}T00:00:00+05:30`) }),
    ...(f.to && { lte: new Date(`${f.to}T23:59:59+05:30`) }),
  };
  const q = f.q?.trim();
  return {
    ...(status && { status }),
    ...(f.plan && { plan: f.plan }),
    ...(Object.keys(range).length && { [dateField]: range }),
    ...(f.kind === "demo" && { demo: true }),
    ...(f.kind === "offline" && { offline: true }),
    ...(f.kind === "online" && { demo: false, offline: false }),
    ...(q && {
      OR: [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { razorpayPaymentId: { contains: q } },
        { couponCode: { contains: q.toUpperCase() } },
        { profile: { code: { equals: q.toUpperCase() } } },
        { profile: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
}
