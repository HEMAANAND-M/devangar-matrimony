import "server-only";
import { db } from "./db";
import { PLANS, type Plan } from "./premium";
import { getSetting } from "./settings";

/**
 * Live plan list: the admin-edited "plans" setting, or the defaults in lib/premium.ts.
 * Kept apart from lib/premium.ts so client code can still import that file.
 */
export async function getPlans({ includeInactive = false } = {}): Promise<Plan[]> {
  const saved = await getSetting<Plan[] | null>("plans", null);
  const plans = saved?.length ? saved : [...PLANS];
  return includeInactive ? plans : plans.filter((p) => p.active !== false);
}

export async function getPlan(id: string, opts?: { includeInactive?: boolean }) {
  return (await getPlans(opts)).find((p) => p.id === id);
}

/** Plan display name for a stored payment, even if the plan has since been removed. */
export async function planNames(): Promise<Map<string, string>> {
  const all = await getPlans({ includeInactive: true });
  return new Map([...PLANS, ...all].map((p) => [p.id, p.name]));
}

export const normalizeCoupon = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);

export type CouponResult = { ok: true; code: string; discount: number } | { ok: false; error: string };

/**
 * Validates a coupon for a plan and returns the discount in paise. The total never drops below
 * ₹1, which is Razorpay's minimum charge.
 */
/** `profileId`: each coupon can be used once per profile (festival offers are per family, not per renewal). */
export async function evaluateCoupon(rawCode: string, plan: Plan, profileId?: string): Promise<CouponResult> {
  const code = normalizeCoupon(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code." };
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "This coupon is not valid." };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { ok: false, error: "This coupon has expired." };
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) return { ok: false, error: "This coupon has been fully used." };
  if (coupon.plans.length && !coupon.plans.includes(plan.id)) return { ok: false, error: `This coupon does not apply to ${plan.name}.` };
  if (profileId && (await db.payment.findFirst({ where: { profileId, couponCode: code, status: { in: ["PAID", "REFUNDED"] } }, select: { id: true } }))) {
    return { ok: false, error: "You have already used this coupon." };
  }
  const raw = coupon.percentOff ? Math.round((plan.amount * coupon.percentOff) / 100) : (coupon.amountOff ?? 0);
  const discount = Math.max(0, Math.min(raw, plan.amount - 100));
  return { ok: true, code, discount };
}
