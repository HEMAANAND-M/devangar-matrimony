"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { deliver } from "@/lib/notify";
import { getPlans, normalizeCoupon } from "@/lib/plans";
import type { Plan } from "@/lib/premium";
import { razorpayConfigured, refundRazorpayPayment } from "@/lib/razorpay";
import { requireAdmin } from "@/lib/session";
import { setSetting } from "@/lib/settings";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const rupeesToPaise = (v: string) => {
  const n = Number(v.replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

/** IST date input ("2026-10-20") to the end of that day. */
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:59+05:30`) : null);
const startOfDay = (v: string) => (v ? new Date(`${v}T00:00:00+05:30`) : null);

// ——— Plans ———

export async function savePlans(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const count = Number(str(fd, "count")) || 0;
  const existing = new Map((await getPlans({ includeInactive: true })).map((p) => [p.id, p]));
  const plans: Plan[] = [];
  for (let i = 0; i < count; i++) {
    const name = str(fd, `name_${i}`);
    if (!name) continue;
    const months = Number(str(fd, `months_${i}`));
    const amount = rupeesToPaise(str(fd, `price_${i}`));
    if (!Number.isInteger(months) || months < 1 || months > 36) return { error: `${name}: months must be between 1 and 36.` };
    if (!amount || amount < 100) return { error: `${name}: enter a price of at least ₹1.` };
    // Ids are stable once created so past payments keep their plan name.
    const id = str(fd, `id_${i}`) || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${months}`;
    if (plans.some((p) => p.id === id)) return { error: `Two plans share the id ${id}. Change a name or duration.` };
    plans.push({
      id,
      name: name.slice(0, 40),
      months,
      amount,
      tagline: str(fd, `tagline_${i}`).slice(0, 60),
      featured: fd.get(`featured_${i}`) === "on",
      active: fd.get(`active_${i}`) === "on",
    });
  }
  // Plans removed from the form are kept as inactive so their history still resolves.
  for (const [id, plan] of existing) if (!plans.some((p) => p.id === id)) plans.push({ ...plan, active: false });
  if (!plans.some((p) => p.active)) return { error: "Keep at least one plan active." };
  await setSetting("plans", plans);
  await log(admin.id, "plans.update", "plans", plans.filter((p) => p.active).map((p) => `${p.name} ₹${p.amount / 100}`).join(", "));
  revalidatePath("/admin/coupons");
  revalidatePath("/upgrade");
  return { message: "Plans saved." };
}

// ——— Coupons ———

export async function createCoupon(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const code = normalizeCoupon(str(fd, "code"));
  if (code.length < 3) return { error: "Coupon codes need at least 3 letters or digits." };
  const kind = str(fd, "kind");
  const value = Number(str(fd, "value"));
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter the discount value." };
  if (kind === "percent" && (value > 90 || !Number.isInteger(value))) return { error: "Percentage must be a whole number up to 90." };
  const maxUses = str(fd, "maxUses") ? Number(str(fd, "maxUses")) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return { error: "Max uses must be a positive whole number." };
  const plans = fd.getAll("plans").filter((p): p is string => typeof p === "string" && !!p);
  if (await db.coupon.findUnique({ where: { code } })) return { error: `${code} already exists.` };
  await db.coupon.create({
    data: {
      code,
      percentOff: kind === "percent" ? value : null,
      amountOff: kind === "amount" ? Math.round(value * 100) : null,
      plans,
      maxUses,
      expiresAt: endOfDay(str(fd, "expiresAt")),
    },
  });
  await log(admin.id, "coupon.create", code, kind === "percent" ? `${value}% off` : `₹${value} off`);
  revalidatePath("/admin/coupons");
  return { message: `Coupon ${code} created.` };
}

export async function setCouponActive(id: string, active: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  const coupon = await db.coupon.update({ where: { id }, data: { active } });
  await log(admin.id, active ? "coupon.activate" : "coupon.deactivate", coupon.code);
  revalidatePath("/admin/coupons");
  return { message: active ? "Activated" : "Deactivated" };
}

export async function deleteCoupon(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) return { error: "Coupon not found." };
  // Used coupons stay for the record; they can only be deactivated.
  if (coupon.uses > 0) return { error: "This coupon has been used, so it can only be deactivated." };
  await db.coupon.delete({ where: { id } });
  await log(admin.id, "coupon.delete", coupon.code);
  revalidatePath("/admin/coupons");
  return { message: "Deleted" };
}

// ——— Refunds ———

export async function refundPayment(paymentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { profile: { select: { premiumUntil: true } } } });
  if (!payment || payment.status !== "PAID") return { error: "Only paid payments can be refunded." };
  const amount = str(fd, "amount") ? rupeesToPaise(str(fd, "amount")) : payment.amount;
  if (!amount || amount > payment.amount) return { error: `Refund must be between ₹1 and the paid amount.` };
  const revoke = fd.get("revoke") === "on";

  let refundId: string | null = null;
  if (razorpayConfigured() && payment.razorpayPaymentId && !payment.demo && !payment.offline) {
    try {
      refundId = (await refundRazorpayPayment(payment.razorpayPaymentId, amount, { paymentId: payment.id, by: admin.id })).id;
    } catch (e) {
      console.error(e);
      return { error: "Razorpay could not process the refund. Check the Razorpay dashboard and try again." };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: amount, refundId },
    });
    if (revoke && payment.profileId && payment.profile?.premiumUntil) {
      const until = new Date(payment.profile.premiumUntil);
      until.setMonth(until.getMonth() - payment.months);
      await tx.profile.update({ where: { id: payment.profileId }, data: { premiumUntil: until } });
    }
  });
  await log(admin.id, "payment.refund", payment.id, `₹${amount / 100}${revoke ? ", premium revoked" : ""}${refundId ? `, ${refundId}` : ", recorded manually"}`);
  revalidatePath("/admin/payments");
  return { message: refundId ? `Refund ${refundId} issued.` : "Refund recorded." };
}

// ——— Announcements ———

const AUDIENCES = ["all", "free", "premium", "male", "female", "staff"];

export async function saveAnnouncement(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = str(fd, "title").slice(0, 120);
  const body = str(fd, "body").slice(0, 600);
  if (!title || !body) return { error: "Add a title and a message." };
  const href = str(fd, "href");
  if (href && !/^(\/[^/]|https:\/\/)/.test(href)) return { error: "Links must start with / or https://" };
  const audience = AUDIENCES.includes(str(fd, "audience")) ? str(fd, "audience") : "all";
  const data = {
    title,
    body,
    href: href || null,
    audience,
    active: fd.get("active") === "on",
    startsAt: startOfDay(str(fd, "startsAt")) ?? new Date(),
    endsAt: endOfDay(str(fd, "endsAt")),
  };
  const saved = id
    ? await db.announcement.update({ where: { id }, data })
    : await db.announcement.create({ data: { ...data, createdById: admin.id } });
  await log(admin.id, id ? "announcement.update" : "announcement.create", saved.id, title);
  revalidatePath("/admin/communications");
  revalidatePath("/", "layout");
  return { message: id ? "Announcement updated." : "Announcement published." };
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  await db.announcement.update({ where: { id }, data: { active } });
  await log(admin.id, active ? "announcement.activate" : "announcement.deactivate", id);
  revalidatePath("/admin/communications");
  revalidatePath("/", "layout");
  return { message: active ? "Shown" : "Hidden" };
}

export async function deleteAnnouncement(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  await db.announcement.delete({ where: { id } });
  await log(admin.id, "announcement.delete", id);
  revalidatePath("/admin/communications");
  revalidatePath("/", "layout");
  return { message: "Deleted" };
}

// ——— Notifications ———

export async function resendNotification(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const reset = await db.notification.updateMany({
    where: { id, status: { in: ["FAILED", "NOT_CONFIGURED"] } },
    data: { status: "PENDING", error: null },
  });
  if (!reset.count) return { error: "Only failed or unsent messages can be resent." };
  await deliver(id);
  const n = await db.notification.findUnique({ where: { id }, select: { status: true, template: true } });
  await log(admin.id, "notification.resend", id, n?.template);
  revalidatePath("/admin/communications");
  return n?.status === "SENT" ? { message: "Sent" } : { error: `Still not delivered (${n?.status.toLowerCase().replace("_", " ")}).` };
}
