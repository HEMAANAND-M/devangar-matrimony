import { verifyHmac } from "@/lib/crypto";
import { db } from "@/lib/db";
import { activatePayment } from "@/lib/payments";

/**
 * Razorpay webhook (configure in Dashboard → Webhooks with events order.paid and payment.captured).
 * Confirms payments even if the member closes the browser before the checkout callback runs.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyHmac(body, signature, secret)) return new Response("Invalid signature", { status: 400 });

  type Event = { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } } };
  let event: Event;
  try {
    event = JSON.parse(body) as Event;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const entity = event.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "order.paid") && entity?.order_id) {
    const payment = await db.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
    // Amount must match what we charged; anything else is ignored rather than activated.
    if (payment && payment.amount === entity.amount) await activatePayment(payment.id, entity.id);
  } else if (event.event === "payment.failed" && entity?.order_id) {
    await db.payment.updateMany({ where: { razorpayOrderId: entity.order_id, status: "CREATED" }, data: { status: "FAILED" } });
  }
  return Response.json({ ok: true });
}
