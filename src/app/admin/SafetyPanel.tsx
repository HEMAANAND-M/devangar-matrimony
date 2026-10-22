import Link from "next/link";
import { Panel } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { FLAG_INFO } from "@/lib/flags";

/** Automatic risk flags and account restrictions, each linking to the matching members. */
export async function SafetyPanel() {
  const [flagRows, statusRows, attacked] = await Promise.all([
    db.$queryRaw<{ flag: string; count: bigint }[]>`
      SELECT f AS flag, count(*) AS count FROM "Profile", unnest(flags) AS f GROUP BY f ORDER BY count DESC`,
    db.user.groupBy({ by: ["status"], where: { status: { not: "ACTIVE" } }, _count: true }),
    // The login limiter counts attempts per number in 15-minute windows; 5+ suggests password guessing.
    db.rateLimit.count({ where: { key: { startsWith: "login:phone:", not: "login:phone:invalid" }, count: { gte: 5 }, resetAt: { gt: new Date() } } }),
  ]);
  const restricted = Object.fromEntries(statusRows.map((r) => [r.status, r._count]));
  const items: { href: string; label: string; detail: string; count: number }[] = [
    ...flagRows.map((r) => ({
      href: `/admin/members?flagged=${r.flag}`,
      label: FLAG_INFO[r.flag]?.label ?? r.flag,
      detail: FLAG_INFO[r.flag]?.detail ?? "",
      count: Number(r.count),
    })),
    {
      href: "/admin/activity",
      label: "Sign-in bursts (15 min)",
      detail: "Accounts with 5 or more sign-in attempts in the current 15-minute window — possible password guessing. Attempts are blocked after 8.",
      count: attacked,
    },
    { href: "/admin/members?account=SUSPENDED", label: "Suspended accounts", detail: "Temporarily blocked from signing in.", count: restricted.SUSPENDED ?? 0 },
    { href: "/admin/members?account=BANNED", label: "Banned accounts", detail: "Permanently closed.", count: restricted.BANNED ?? 0 },
  ];

  return (
    <Panel title="Trust & safety" description="Automatic risk flags on member profiles and restricted accounts." flush>
      <ul className="grid divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.href} className="sm:border-b sm:border-hairline">
            <Link href={item.href} title={item.detail} className="flex h-full items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-cream/60">
              <span className="text-sm text-stone-700">{item.label}</span>
              <span className={`text-lg font-semibold tabular-nums ${item.count ? "text-maroon" : "text-stone-400"}`}>{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
