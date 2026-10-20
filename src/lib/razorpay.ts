import "server-only";

export const razorpayConfigured = () => !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

/** No-charge checkout for demos: always allowed in development, and in production only if opted in. */
export const demoPaymentsAllowed = () =>
  !razorpayConfigured() && (process.env.NODE_ENV !== "production" || process.env.PAYMENTS_DEMO === "true");

/** Creates a Razorpay order (https://razorpay.com/docs/api/orders/create/). */
export async function createRazorpayOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: input.amount, currency: "INR", receipt: input.receipt, notes: input.notes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; amount: number; currency: string };
}

const authHeader = () =>
  `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

/** Refunds a captured payment, fully or partly (https://razorpay.com/docs/api/refunds/create-normal/). */
export async function refundRazorpayPayment(razorpayPaymentId: string, amount: number, notes: Record<string, string>) {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/refund`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount, notes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Razorpay refund failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id: string; amount: number; status: string };
}
