import { firstName, istDayStart } from "@/lib/campaigns";
import { cronAuthorized } from "@/lib/cron";
import { db } from "@/lib/db";
import { link, notifyProfile, type Template } from "@/lib/notify";
import { getPlans } from "@/lib/plans";

export const maxDuration = 60;

// A reminder is never repeated within this window, even if the job runs twice.
const REPEAT_GAP = 20 * 60 * 60 * 1000;

/**
 * Daily: reminds premium members 7 days and 1 day before their membership ends, and nudges those
 * whose membership ended yesterday. Each message carries a one-tap renewal link to their plan.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const plans = await getPlans();
  const fallbackPlan = plans.find((p) => p.featured) ?? plans[0];
  const windows: { template: Template; from: Date; to: Date }[] = [
    { template: "premium_expiring", from: istDayStart(7), to: istDayStart(8) },
    { template: "premium_expiring", from: istDayStart(1), to: istDayStart(2) },
    { template: "premium_expired", from: istDayStart(-1), to: istDayStart(0) },
  ];

  const sent: Record<string, number> = { premium_expiring: 0, premium_expired: 0, skipped: 0 };
  for (const w of windows) {
    const profiles = await db.profile.findMany({
      where: { premiumUntil: { gte: w.from, lt: w.to }, status: { not: "MARRIED" }, user: { status: "ACTIVE" } },
      select: {
        id: true,
        name: true,
        userId: true,
        premiumUntil: true,
        payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1, select: { plan: true } },
      },
      take: 5000,
    });
    for (const p of profiles) {
      const recent = await db.notification.findFirst({
        where: { userId: p.userId, template: w.template, createdAt: { gte: new Date(Date.now() - REPEAT_GAP) } },
        select: { id: true },
      });
      if (recent) {
        sent.skipped++;
        continue;
      }
      const lastPlan = p.payments[0]?.plan;
      const plan = plans.find((x) => x.id === lastPlan) ?? fallbackPlan;
      const renew = link(`/upgrade?${plan ? `plan=${encodeURIComponent(plan.id)}&` : ""}renew=1`);
      const until = p.premiumUntil!.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
      await notifyProfile(p.id, w.template, { name: firstName(p.name), until, link: renew });
      sent[w.template]++;
    }
  }
  return Response.json(sent, { headers: { "Cache-Control": "no-store" } });
}
