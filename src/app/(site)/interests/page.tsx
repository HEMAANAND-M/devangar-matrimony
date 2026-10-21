import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { respondInterest, withdrawInterest } from "@/app/actions/interactions";
import { Card, PageHeader } from "@/components/Card";
import { ContactRequestsInbox } from "@/components/ContactRequestsInbox";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { type TKey, getT } from "@/lib/i18n";
import { isPremium } from "@/lib/premium";
import { isStaff, requireProfile } from "@/lib/session";

export const metadata = { title: "Interests" };

const TABS = {
  received: "int.tab.received",
  sent: "int.tab.sent",
  accepted: "int.tab.accepted",
} as const;
type Tab = keyof typeof TABS;

const EMPTY: Record<Tab, [title: TKey, body: TKey, cta: [href: string, label: TKey]]> = {
  received: ["int.empty.received", "int.empty.received.body", ["/profile/edit", "int.empty.received.cta"]],
  sent: ["int.empty.sent", "int.empty.sent.body", ["/search", "int.findProfiles"]],
  accepted: ["int.empty.accepted", "int.empty.accepted.body", ["/search", "int.findProfiles"]],
};

export default async function InterestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireProfile();
  const premium = isPremium(profile) || isStaff(user);
  const requested = (await searchParams).tab;
  const tab: Tab = requested === "sent" || requested === "accepted" ? requested : "received";

  const where: Prisma.InterestWhereInput =
    tab === "sent"
      ? { fromId: profile.id }
      : tab === "received"
        ? { toId: profile.id }
        : { status: "ACCEPTED", OR: [{ fromId: profile.id }, { toId: profile.id }] };
  const [interests, pendingCount] = await Promise.all([
    db.interest.findMany({
      where,
      include: { from: true, to: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.interest.count({ where: { toId: profile.id, status: "PENDING" } }),
  ]);
  const tr = await getT();

  const tabCls = (t: Tab) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm transition sm:px-5 ${tab === t ? "bg-maroon text-white shadow-soft" : "text-stone-600 hover:text-maroon"}`;
  const [emptyTitle, emptyBody, [ctaHref, ctaLabel]] = EMPTY[tab];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow={tr("int.eyebrow")} title={tr("int.title")} subtitle={tr("int.subtitle")} />
      <div className="max-w-full overflow-x-auto">
        <div className="inline-flex gap-1 rounded-full border border-hairline bg-white p-1 shadow-soft">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <Link key={t} href={t === "received" ? "/interests" : `/interests?tab=${t}`} className={tabCls(t)}>
              {tr(TABS[t])}
              {t === "received" && pendingCount > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-px text-xs font-semibold ${tab === t ? "bg-white/20" : "bg-gold-light text-maroon"}`}>{pendingCount}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {interests.length === 0 && (
        <Card>
          <div className="py-4 text-center">
            <p className="font-display text-2xl text-maroon">{tr(emptyTitle)}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{tr(emptyBody)}</p>
            <Link href={ctaHref} className="mt-4 inline-block rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">{tr(ctaLabel)}</Link>
          </div>
        </Card>
      )}
      {interests.map((i) => {
        const other = i.fromId === profile.id ? i.to : i.from;
        const incoming = i.toId === profile.id;
        return (
          <Card key={i.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/profiles/${other.code}`} className="font-semibold text-maroon hover:underline">
                  {other.name} ({other.code})
                </Link>
                <p className="text-sm text-stone-600">
                  {tr("common.yrs", { age: ageFrom(other.dateOfBirth) })} · {other.occupation} · {other.city}
                </p>
                {i.message && <p className="mt-2 break-words text-sm italic text-stone-700">“{i.message}”</p>}
                {i.status === "ACCEPTED" && (
                  premium ? (
                    <p className="mt-2 text-sm text-stone-600">
                      {tr("int.connected")} ·{" "}
                      <Link href={`/profiles/${other.code}`} className="font-medium text-maroon underline decoration-gold/50 underline-offset-4">{tr("int.messageOrRequest")}</Link>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-stone-600">
                      {tr("int.connected")} ·{" "}
                      <Link href="/upgrade" className="font-medium text-maroon underline decoration-gold/50 underline-offset-4">{tr("int.upgradeToMessage")}</Link>
                    </p>
                  )
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {i.status !== "PENDING" ? (
                  <span className={i.status === "ACCEPTED" ? "text-green-700" : "text-stone-500"}>{tr(i.status === "ACCEPTED" ? "int.status.connected" : (`int.status.${i.status.toLowerCase()}` as TKey))}</span>
                ) : incoming ? (
                  <>
                    <form action={respondInterest.bind(null, i.id, true)}>
                      <button className="rounded-full bg-maroon px-4 py-1.5 text-white shadow-soft hover:bg-maroon-dark">{tr("int.accept")}</button>
                    </form>
                    <form action={respondInterest.bind(null, i.id, false)}>
                      <button className="rounded-full border border-hairline px-4 py-1.5 hover:border-gold">{tr("int.decline")}</button>
                    </form>
                  </>
                ) : (
                  <>
                    <span className="text-stone-500">{tr("int.status.pending")}</span>
                    <form action={withdrawInterest.bind(null, i.id)}>
                      <button className="text-stone-600 underline">{tr("int.withdraw")}</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <section className="pt-6">
        <p className="eyebrow text-gold-dark">{tr("int.privacy")}</p>
        <h2 className="mt-1 text-2xl text-maroon">{tr("int.phoneRequests")}</h2>
        <p className="mt-1 text-sm text-stone-600">{tr("int.phoneRequestsBody")}</p>
        <div className="mt-4">
          <ContactRequestsInbox profileId={profile.id} />
        </div>
      </section>
    </div>
  );
}
