import { db } from "@/lib/db";
import { dobRangeForAges } from "@/lib/format";
import { deliver, link } from "@/lib/notify";
import { browsableWhere } from "@/lib/queries";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Weekly job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 *  1. WhatsApp "new matches this week" digest for opted-in members.
 *  2. Deletes ID documents nobody reviewed within 30 days (data minimisation).
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY);

  const expired = await db.idVerification.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now - 30 * DAY) } },
    data: { status: "REJECTED", rejectionReason: "Expired before review — please resubmit.", document: null, documentMime: null, reviewedAt: new Date() },
  });

  const members = await db.profile.findMany({
    where: {
      status: "APPROVED",
      OR: [{ user: { whatsappOptIn: true } }, { managers: { some: { user: { whatsappOptIn: true } } } }],
    },
    select: {
      id: true, name: true, gender: true, prefAgeMin: true, prefAgeMax: true, prefMaritalStatus: true,
      user: { select: { id: true, whatsappOptIn: true } },
      managers: { select: { user: { select: { id: true, whatsappOptIn: true } } } },
    },
  });

  let sent = 0;
  for (const m of members) {
    const count = await db.profile.count({
      where: {
        ...browsableWhere(m),
        createdAt: { gte: weekAgo },
        ...(m.prefAgeMin || m.prefAgeMax ? { dateOfBirth: dobRangeForAges(m.prefAgeMin ?? 18, m.prefAgeMax ?? 80) } : {}),
        ...(m.prefMaritalStatus.length ? { maritalStatus: { in: m.prefMaritalStatus } } : {}),
      },
    });
    if (!count) continue;
    for (const u of [m.user, ...m.managers.map((x) => x.user)].filter((u) => u.whatsappOptIn)) {
      // At most one digest per person per week, even if the job is retried.
      const already = await db.notification.findFirst({ where: { userId: u.id, template: "weekly_matches", createdAt: { gte: new Date(now - 6 * DAY) } } });
      if (already) continue;
      const n = await db.notification.create({
        data: { userId: u.id, template: "weekly_matches", params: [m.name.split(" ")[0], String(count), link("/dashboard")] },
      });
      await deliver(n.id);
      sent++;
    }
  }
  return Response.json({ digestsSent: sent, membersChecked: members.length, expiredIdDocuments: expired.count });
}
