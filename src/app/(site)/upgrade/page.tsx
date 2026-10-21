import Link from "next/link";
import { PremiumBadge } from "@/components/Badges";
import { Card, PageHeader } from "@/components/Card";
import { CheckoutButton } from "@/components/CheckoutButton";
import { inputCls } from "@/components/fields";
import { db } from "@/lib/db";
import { evaluateCoupon, getPlans, normalizeCoupon, planNames } from "@/lib/plans";
import { getT, getTx } from "@/lib/i18n";
import { PREMIUM_BENEFITS, isPremium, rupees } from "@/lib/premium";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Premium membership" };

export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ coupon?: string }> }) {
  const { profile } = await requireProfile();
  const premium = isPremium(profile);
  const couponCode = normalizeCoupon((await searchParams).coupon ?? "");
  const [plans, names, payments, paymentsOn] = await Promise.all([
    getPlans(),
    planNames(),
    db.payment.findMany({
      where: { profileId: profile.id, status: { in: ["PAID", "REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
    featureEnabled("payments"),
  ]);
  // Evaluate the coupon per plan: a code can be limited to some plans.
  const priced = await Promise.all(
    plans.map(async (plan) => ({ plan, coupon: couponCode ? await evaluateCoupon(couponCode, plan, profile.id) : null })),
  );
  const couponError = couponCode && priced.every((p) => p.coupon && !p.coupon.ok) ? (priced[0]?.coupon as { error: string } | undefined)?.error : null;
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const [t, tx] = await Promise.all([getT(), getTx()]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={t("up.eyebrow")}
        title={t("up.title")}
        subtitle={
          premium ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <PremiumBadge /> {t("up.activeUntil", { date: fmt(profile.premiumUntil!) })}
            </span>
          ) : (
            t("up.lead")
          )
        }
      />

      <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {PREMIUM_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-stone-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-maroon text-[0.65rem] text-gold-light">✓</span>
            {tx(b)}
          </li>
        ))}
      </ul>

      {!paymentsOn ? (
        <p className="mx-auto max-w-xl rounded-2xl border border-gold/50 bg-cream px-6 py-5 text-center text-sm text-stone-700">
          {t("up.paused")} <Link href="/support" className="text-maroon underline decoration-gold/50 underline-offset-4">{t("up.pausedLink")}</Link> {t("up.pausedEnd")}
        </p>
      ) : (
        <>
          <form method="get" className="mx-auto flex max-w-md flex-wrap items-end gap-2">
            <label className="flex-1 text-[0.8rem] font-medium tracking-wide text-stone-600">
              {t("up.coupon")}
              <input name="coupon" defaultValue={couponCode} placeholder="e.g. FESTIVE20" autoComplete="off" className={`${inputCls} uppercase`} />
            </label>
            <button className="rounded-full border border-gold/60 px-5 py-2.5 text-sm font-medium text-maroon transition hover:border-gold hover:bg-gold-light/30">{t("up.apply")}</button>
            {couponCode && (
              <Link href="/upgrade" className="px-2 py-2.5 text-sm text-stone-500 hover:text-maroon">{t("up.remove")}</Link>
            )}
            {couponError && <p role="alert" className="w-full text-sm text-red-700">{couponError}</p>}
            {couponCode && !couponError && (
              <p role="status" className="w-full text-sm text-emerald-700">{t("up.couponApplied", { code: couponCode })}</p>
            )}
          </form>

          <div className={`grid gap-6 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {priced.map(({ plan, coupon }) => {
              const featured = !!plan.featured;
              const discount = coupon?.ok ? coupon.discount : 0;
              const price = plan.amount - discount;
              return (
                <section
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl border p-8 text-center shadow-soft ${
                    featured ? "border-gold bg-gradient-to-b from-maroon to-maroon-dark text-white shadow-lift md:-translate-y-3" : "border-hairline bg-white"
                  }`}
                >
                  {featured && (
                    <span className="eyebrow absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1.5 !text-[0.6rem] text-maroon-dark">{t("up.popular")}</span>
                  )}
                  <h2 className={`text-3xl ${featured ? "!text-white" : "text-maroon"}`}>{plan.name}</h2>
                  <p className={`mt-1 text-sm ${featured ? "text-gold-light" : "text-stone-500"}`}>{plan.tagline}</p>
                  {discount > 0 && (
                    <p className={`mt-6 text-sm line-through ${featured ? "text-white/60" : "text-stone-400"}`}>{rupees(plan.amount)}</p>
                  )}
                  <p className={`${discount > 0 ? "mt-1" : "mt-6"} font-display text-5xl font-semibold ${featured ? "text-white" : "text-ink"}`}>{rupees(price)}</p>
                  <p className={`mt-1 text-sm ${featured ? "text-white/70" : "text-stone-500"}`}>
                    {t("up.perMonth", { months: plan.months, price: rupees(Math.round(price / plan.months)) })}
                  </p>
                  {discount > 0 && (
                    <p className={`mt-2 text-xs font-medium ${featured ? "text-gold-light" : "text-emerald-700"}`}>{t("up.save", { amount: rupees(discount) })}</p>
                  )}
                  <div className="mt-8 flex-1" />
                  <CheckoutButton
                    planId={plan.id}
                    couponCode={discount > 0 ? couponCode : undefined}
                    label={premium ? t("up.extend") : t("up.choose", { plan: plan.name })}
                    featured={featured}
                    labels={{
                      welcome: t("checkout.welcome"),
                      demo: t("checkout.demo"),
                      demoBody: t("checkout.demoBody", { plan: "{plan}" }),
                      activating: t("checkout.activating"),
                      complete: t("checkout.complete"),
                      cancel: t("checkout.cancel"),
                      wait: t("checkout.wait"),
                      failed: t("checkout.failed"),
                      failedNoCharge: t("checkout.failedNoCharge"),
                    }}
                  />
                </section>
              );
            })}
          </div>

          <p className="text-center text-xs text-stone-500">
            {razorpayConfigured()
              ? t("up.razorpay")
              : t("up.demo")}
          </p>
        </>
      )}

      {payments.length > 0 && (
        <Card title={t("up.payments")}>
          <ul className="divide-y divide-hairline text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {names.get(p.plan) ?? p.plan} · {t("up.months", { months: p.months })}
                  {p.demo && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-xs text-stone-600">{t("up.demoTag")}</span>}
                  {p.status === "REFUNDED" && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-xs text-stone-600">{t("up.refunded")}</span>}
                </span>
                <span className="flex items-center gap-4 text-stone-600">
                  <span>{rupees(p.amount)} · {p.paidAt && fmt(p.paidAt)}</span>
                  {p.invoiceNumber && (
                    <Link href={`/invoices/${p.id}`} className="text-maroon underline decoration-gold/50 underline-offset-4">{t("up.invoice")}</Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
