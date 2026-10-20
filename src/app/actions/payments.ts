"use server";

import { revalidatePath } from "next/cache";
import { verifyHmac } from "@/lib/crypto";
import { db } from "@/lib/db";
import { activatePayment } from "@/lib/payments";
import { findPlan } from "@/lib/premium";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { createRazorpayOrder, demoPaymentsAllowed, razorpayConfigured } from "@/lib/razorpay";
import { requireProfile } from "@/lib/session";

export type CheckoutStart =
  | { kind: "razorpay"; orderId: string; keyId: string; amount: number; planName: string; phone: string }
  | { kind: "demo"; paymentId: string; amount: number; planName: string }
  | { kind: "error"; error: string };

export async function startCheckout(planId: string): Promise<CheckoutStart> {
  const { user, profile } = await requireProfile();
  if (!(await rateLimitAll([[`checkout:${user.id}`, 10, HOUR]]))) return { kind: "error", error: RATE_LIMITED };
  const plan = findPlan(planId);
  if (!plan) return { kind: "error", error: "Unknown plan." };

  if (!razorpayConfigured() && !demoPaymentsAllowed()) {
    return { kind: "error", error: "Online payments are not available yet. Please contact support." };
  }

  const payment = await db.payment.create({
    data: { profileId: profile.id, paidById: user.id, plan: plan.id, months: plan.months, amount: plan.amount, demo: !razorpayConfigured() },
  });

  if (!razorpayConfigured()) return { kind: "demo", paymentId: payment.id, amount: plan.amount, planName: plan.name };

  try {
    const order = await createRazorpayOrder({
      amount: plan.amount,
      receipt: payment.id,
      notes: { paymentId: payment.id, profileCode: profile.code, plan: plan.id },
    });
    await db.payment.update({ where: { id: payment.id }, data: { razorpayOrderId: order.id } });
    return { kind: "razorpay", orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID!, amount: plan.amount, planName: plan.name, phone: user.phone };
  } catch (e) {
    console.error(e);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { kind: "error", error: "Could not start the payment. Please try again." };
  }
}

/** Called by the checkout handler; trusts nothing from the browser except a valid Razorpay signature. */
export async function confirmRazorpayPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<{ ok: boolean; error?: string }> {
  const { profile } = await requireProfile();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return { ok: false, error: "Payments are not configured." };
  if (!verifyHmac(`${input.orderId}|${input.paymentId}`, input.signature, secret)) {
    return { ok: false, error: "Payment could not be verified. If money was deducted, it will be confirmed automatically." };
  }
  const payment = await db.payment.findFirst({ where: { razorpayOrderId: input.orderId, profileId: profile.id } });
  if (!payment) return { ok: false, error: "Payment not found." };
  await activatePayment(payment.id, input.paymentId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeDemoPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const { profile } = await requireProfile();
  if (!demoPaymentsAllowed()) return { ok: false, error: "Demo payments are disabled." };
  const payment = await db.payment.findFirst({ where: { id: paymentId, profileId: profile.id, demo: true, status: "CREATED" } });
  if (!payment) return { ok: false, error: "Payment not found." };
  await activatePayment(payment.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
