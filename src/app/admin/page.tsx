import Link from "next/link";
import { Prisma } from "@prisma/client";
import { BarList, DailyBars, GenderSplit, type DayPoint } from "@/components/admin/charts";
import { AdminPageHeader, Badge, Panel, StatCard, label, statusTone } from "@/components/admin/ui";
import { MARITAL_STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { rupees } from "@/lib/premium";
import { requireStaff } from "@/lib/session";
import { actionLabel } from "./activity/labels";
import { SafetyPanel } from "./SafetyPanel";

export const metadata = { title: "Dashboard" };

const DAY = 24 * 60 * 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;
const DAYS = 30;

/** Day buckets in India time, oldest first, with empty days filled in. */
function fillDays(rows: { day: Date; value: bigint | number | null }[], days: number): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.value ?? 0)]));
  const today = Date.now() + IST;
  return Array.from({ length: days }, (_, i) => {
    const key = new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10);
    return { day: key, value: byDay.get(key) ?? 0 };
  });
}

const perDay = (table: "User" | "Interest", since: Date) =>
  db.$queryRaw<{ day: Date; value: bigint }[]>`
    SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day, count(*) AS value
    FROM ${Prisma.raw(`"${table}"`)} WHERE "createdAt" >= ${since} GROUP BY 1`;

function waited(since: Date): string {
  const hours = Math.floor((Date.now() - since.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

export default async function AdminOverview() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const now = new Date();
  const startOfToday = new Date(`${new Date(now.getTime() + IST).toISOString().slice(0, 10)}T00:00:00+05:30`);
  const week = new Date(now.getTime() - 7 * DAY);
  const since = new Date(startOfToday.getTime() - (DAYS - 1) * DAY);

  const [
    totalMembers, liveProfiles, signupsToday, signups7, interests7, accepted7, queues,
    signupSeries, interestSeries, genders, marital, cityGender, ageBands, recentSignups,
  ] = await Promise.all([
    db.user.count({ where: { role: "USER" } }),
    db.profile.count({ where: { status: "APPROVED" } }),
    db.user.count({ where: { role: "USER", createdAt: { gte: startOfToday } } }),
    db.user.count({ where: { role: "USER", createdAt: { gte: week } } }),
    db.interest.count({ where: { createdAt: { gte: week } } }),
    db.interest.count({ where: { status: "ACCEPTED", updatedAt: { gte: week } } }),
    Promise.all([
      Promise.all([
        db.profile.count({ where: { status: "PENDING" } }),
        db.profile.findFirst({ where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }).then((r) => r?.updatedAt),
      ]),
      Promise.all([
        db.photo.count({ where: { approved: false } }),
        db.photo.findFirst({ where: { approved: false }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }).then((r) => r?.createdAt),
      ]),
      Promise.all([
        db.report.count({ where: { resolved: false } }),
        db.report.findFirst({ where: { resolved: false }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }).then((r) => r?.createdAt),
      ]),
      // Moderators review selfies only; ID documents are admin-only.
      Promise.all([
        db.idVerification.count({ where: { status: "PENDING", ...(isAdmin ? {} : { docType: "SELFIE" as const }) } }),
        db.idVerification
          .findFirst({ where: { status: "PENDING", ...(isAdmin ? {} : { docType: "SELFIE" as const }) }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
          .then((r) => r?.createdAt),
      ]),
      Promise.all([
        db.supportTicket.count({ where: { status: "OPEN" } }),
        db.supportTicket.findFirst({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }).then((r) => r?.createdAt),
      ]),
    ]),
    perDay("User", since),
    perDay("Interest", since),
    db.profile.groupBy({ by: ["gender"], where: { status: "APPROVED" }, _count: true }),
    db.profile.groupBy({ by: ["maritalStatus"], where: { status: "APPROVED" }, _count: true }),
    db.profile.groupBy({ by: ["city", "gender"], where: { status: "APPROVED" }, _count: true }),
    db.$queryRaw<{ band: string; value: bigint }[]>`
      SELECT CASE
        WHEN a < 25 THEN '18–24' WHEN a < 30 THEN '25–29' WHEN a < 35 THEN '30–34'
        WHEN a < 40 THEN '35–39' ELSE '40+' END AS band, count(*) AS value
      FROM (SELECT date_part('year', age("dateOfBirth")) AS a FROM "Profile" WHERE status = 'APPROVED') t
      GROUP BY 1 ORDER BY 1`,
    db.user.findMany({
      where: { role: "USER" },
      select: { id: true, createdAt: true, phoneVerified: true, profile: { select: { code: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  // Money and the staff audit trail are not even queried for moderators.
  const money = isAdmin
    ? await Promise.all([
        db.payment.aggregate({ where: { status: "PAID", demo: false, paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
        db.profile.count({ where: { premiumUntil: { gt: now } } }),
        db.$queryRaw<{ day: Date; value: bigint | null }[]>`
          SELECT date_trunc('day', "paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day, sum(amount) AS value
          FROM "Payment" WHERE status = 'PAID' AND demo = false AND "paidAt" >= ${since} GROUP BY 1`,
        db.adminLog.findMany({ include: { admin: { select: { role: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
      ])
    : null;

  const queueCards = [
    { href: "/admin/approvals", title: "Profiles to review", q: queues[0] },
    { href: "/admin/photos", title: "Photos to review", q: queues[1] },
    { href: "/admin/reports", title: "Open reports", q: queues[2] },
    { href: "/admin/verifications", title: isAdmin ? "ID & selfie checks" : "Selfie checks", q: queues[3] },
    { href: "/admin/support", title: "Support tickets", q: queues[4] },
  ];

  const cities = new Map<string, { city: string; brides: number; grooms: number }>();
  for (const row of cityGender) {
    const entry = cities.get(row.city) ?? { city: row.city, brides: 0, grooms: 0 };
    if (row.gender === "FEMALE") entry.brides += row._count;
    else entry.grooms += row._count;
    cities.set(row.city, entry);
  }
  const topCities = [...cities.values()].sort((a, b) => b.brides + b.grooms - (a.brides + a.grooms)).slice(0, 8);
  const brides = genders.find((g) => g.gender === "FEMALE")?._count ?? 0;
  const grooms = genders.find((g) => g.gender === "MALE")?._count ?? 0;
  const linkCls = "text-sm text-maroon hover:underline";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={isAdmin ? "Dashboard" : "Moderation dashboard"}
        description={`Community health and the work waiting for the team · ${now.toLocaleDateString("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" })}`}
        actions={<Link href="/admin/members" className="rounded-lg border border-hairline bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:border-gold hover:text-maroon">Find a member</Link>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Members" value={totalMembers.toLocaleString("en-IN")} hint={`${signupsToday} joined today · ${signups7} this week`} href="/admin/members" />
        <StatCard label="Live profiles" value={liveProfiles.toLocaleString("en-IN")} hint={`${brides} brides · ${grooms} grooms`} href="/admin/members?status=APPROVED" />
        <StatCard label="Interests · 7 days" value={interests7.toLocaleString("en-IN")} hint={`${accepted7} accepted${interests7 ? ` (${Math.round((accepted7 / interests7) * 100)}%)` : ""}`} />
        {money ? (
          <StatCard
            label="Revenue · 30 days"
            value={rupees(money[0]._sum.amount ?? 0)}
            hint={`${money[1]} premium · ${liveProfiles ? Math.round((money[1] / liveProfiles) * 100) : 0}% of live profiles`}
            href="/admin/payments"
          />
        ) : (
          <StatCard label="Waiting for review" value={queues[0][0] + queues[1][0]} hint="Profiles and photos" href="/admin/approvals" tone={queues[0][0] + queues[1][0] ? "attention" : "neutral"} />
        )}
      </div>

      <Panel title="Waiting for the team" description="Oldest item in each queue. Aim to clear everything within a day." flush>
        <ul className="grid divide-y divide-hairline sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {queueCards.map(({ href, title, q: [count, oldest] }) => (
            <li key={href}>
              <Link href={href} className="block h-full px-5 py-4 transition hover:bg-cream/60">
                <p className="text-xs font-medium text-stone-500">{title}</p>
                <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${count ? "text-maroon" : "text-ink"}`}>{count}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {count && oldest ? (
                    <>Oldest waiting <span className={Date.now() - oldest.getTime() > DAY ? "font-medium text-red-700" : ""}>{waited(oldest)}</span></>
                  ) : (
                    "All caught up"
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <SafetyPanel />

      <div className={`grid gap-6 ${money ? "xl:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Panel><DailyBars data={fillDays(signupSeries, DAYS)} label="New signups" /></Panel>
        <Panel><DailyBars data={fillDays(interestSeries, DAYS)} label="Interests sent" /></Panel>
        {money && <Panel><DailyBars data={fillDays(money[2], DAYS)} label="Revenue" format={(v) => rupees(v)} /></Panel>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Brides and grooms by city" description="Live profiles in the eight largest cities, and where one side is short" className="lg:col-span-2">
          <GenderSplit rows={topCities} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Age of live profiles">
            <BarList rows={ageBands.map((b) => ({ label: b.band, value: Number(b.value) }))} />
          </Panel>
          <Panel title="Marital status">
            <BarList
              rows={marital
                .map((m) => ({ label: MARITAL_STATUS_LABELS[m.maritalStatus] ?? m.maritalStatus, value: m._count }))
                .sort((a, b) => b.value - a.value)}
            />
          </Panel>
        </div>
      </div>

      <div className={`grid gap-6 ${money ? "lg:grid-cols-2" : ""}`}>
        <Panel title="Newest members" actions={<Link href="/admin/members" className={linkCls}>All members</Link>} flush>
          <ul className="divide-y divide-hairline text-sm">
            {recentSignups.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/members/${u.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-cream/60">
                  <span className="min-w-0 truncate">
                    {u.profile ? <span className="font-medium text-ink">{u.profile.name}</span> : <span className="italic text-stone-500">No profile yet</span>}
                    {u.profile && <span className="ml-2 text-xs text-stone-500">{u.profile.code}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!u.phoneVerified && <Badge tone="amber">Phone unverified</Badge>}
                    {u.profile && <Badge tone={statusTone(u.profile.status)}>{label(u.profile.status)}</Badge>}
                    <span className="hidden text-xs text-stone-500 sm:inline">{dateTime(u.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        {money && (
          <Panel title="Recent staff activity" actions={<Link href="/admin/activity" className={linkCls}>Full log</Link>} flush>
            {money[3].length ? (
              <ul className="divide-y divide-hairline text-sm">
                {money[3].map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-ink">{actionLabel(a.action)}</span>
                      {a.detail && <span className="ml-2 text-xs text-stone-500">{a.detail.slice(0, 60)}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{label(a.admin.role)} · {dateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-stone-500">No staff actions yet.</p>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
