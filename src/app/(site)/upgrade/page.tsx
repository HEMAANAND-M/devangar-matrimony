import { PremiumBadge } from "@/components/Badges";
import { Card, PageHeader } from "@/components/Card";
import { CheckoutButton } from "@/components/CheckoutButton";
import { db } from "@/lib/db";
import { PLANS, PREMIUM_BENEFITS, isPremium, rupees } from "@/lib/premium";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Premium membership" };

export default async function UpgradePage() {
  const { profile } = await requireProfile();
  const premium = isPremium(profile);
  const payments = await db.payment.findMany({
    where: { profileId: profile.id, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 10,
  });
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Membership"
        title="Go Premium"
        subtitle={
          premium ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <PremiumBadge /> Active until {fmt(profile.premiumUntil!)}. Buying again extends your membership.
            </span>
          ) : (
            "Connect faster with the families you like."
          )
        }
      />

      <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {PREMIUM_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-stone-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-maroon text-[0.65rem] text-gold-light">✓</span>
            {b}
          </li>
        ))}
      </ul>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = "featured" in plan && plan.featured;
          return (
            <section
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-8 text-center shadow-soft ${
                featured ? "border-gold bg-gradient-to-b from-maroon to-maroon-dark text-white shadow-lift md:-translate-y-3" : "border-hairline bg-white"
              }`}
            >
              {featured && (
                <span className="eyebrow absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1.5 !text-[0.6rem] text-maroon-dark">Most popular</span>
              )}
              <h2 className={`text-3xl ${featured ? "!text-white" : "text-maroon"}`}>{plan.name}</h2>
              <p className={`mt-1 text-sm ${featured ? "text-gold-light" : "text-stone-500"}`}>{plan.tagline}</p>
              <p className={`mt-6 font-display text-5xl font-semibold ${featured ? "text-white" : "text-ink"}`}>{rupees(plan.amount)}</p>
              <p className={`mt-1 text-sm ${featured ? "text-white/70" : "text-stone-500"}`}>
                {plan.months} months · {rupees(Math.round(plan.amount / plan.months))}/month
              </p>
              <div className="mt-8 flex-1" />
              <CheckoutButton planId={plan.id} label={premium ? "Extend membership" : `Choose ${plan.name}`} featured={featured} />
            </section>
          );
        })}
      </div>

      <p className="text-center text-xs text-stone-500">
        {razorpayConfigured()
          ? "Payments are processed securely by Razorpay — UPI, cards, net banking and wallets. Prices include GST."
          : "Demo mode: Razorpay keys are not configured, so checkout activates membership without charging."}
      </p>

      {payments.length > 0 && (
        <Card title="Payment history">
          <ul className="divide-y divide-hairline text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  {PLANS.find((x) => x.id === p.plan)?.name ?? p.plan} · {p.months} months
                  {p.demo && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-xs text-stone-600">demo</span>}
                </span>
                <span className="text-stone-600">
                  {rupees(p.amount)} · {p.paidAt && fmt(p.paidAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
