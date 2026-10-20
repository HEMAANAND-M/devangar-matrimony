import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { respondInterest, withdrawInterest } from "@/app/actions/interactions";
import { Card, PageHeader } from "@/components/Card";
import { ContactRequestsInbox } from "@/components/ContactRequestsInbox";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { isPremium } from "@/lib/premium";
import { isStaff, requireProfile } from "@/lib/session";

export const metadata = { title: "Interests" };

const TABS = {
  received: "Received",
  sent: "Sent",
  accepted: "Connected",
} as const;
type Tab = keyof typeof TABS;

const EMPTY: Record<Tab, [title: string, body: string, cta: [href: string, label: string]]> = {
  received: [
    "No interests received yet",
    "A complete profile with photos and a horoscope gets noticed sooner. Meanwhile, send interests to members you like.",
    ["/profile/edit", "Improve my profile"],
  ],
  sent: [
    "You haven’t sent any interests",
    "Found someone suitable? Send an interest with a short note from your family.",
    ["/search", "Find profiles"],
  ],
  accepted: [
    "No connections yet",
    "When an interest is accepted on either side, you are connected and can share contact details.",
    ["/search", "Find profiles"],
  ],
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
      include: { from: { include: { user: { select: { phone: true } } } }, to: { include: { user: { select: { phone: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.interest.count({ where: { toId: profile.id, status: "PENDING" } }),
  ]);

  const tabCls = (t: Tab) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm transition sm:px-5 ${tab === t ? "bg-maroon text-white shadow-soft" : "text-stone-600 hover:text-maroon"}`;
  const [emptyTitle, emptyBody, [ctaHref, ctaLabel]] = EMPTY[tab];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Your connections" title="Interests" subtitle="Contact details are shared once an interest is accepted." />
      <div className="max-w-full overflow-x-auto">
        <div className="inline-flex gap-1 rounded-full border border-hairline bg-white p-1 shadow-soft">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <Link key={t} href={t === "received" ? "/interests" : `/interests?tab=${t}`} className={tabCls(t)}>
              {TABS[t]}
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
            <p className="font-display text-2xl text-maroon">{emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{emptyBody}</p>
            <Link href={ctaHref} className="mt-4 inline-block rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon hover:bg-gold-light/30">{ctaLabel}</Link>
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
                  {ageFrom(other.dateOfBirth)} yrs · {other.occupation} · {other.city}
                </p>
                {i.message && <p className="mt-2 break-words text-sm italic text-stone-700">“{i.message}”</p>}
                {i.status === "ACCEPTED" && (
                  premium ? (
                    <p className="mt-2 text-sm">Contact: <a className="font-medium text-maroon" href={`tel:${other.user.phone}`}>{other.user.phone}</a></p>
                  ) : (
                    <p className="mt-2 text-sm text-stone-600">
                      Connected ·{" "}
                      <Link href="/upgrade" className="font-medium text-maroon underline decoration-gold/50 underline-offset-4">Upgrade to view contact</Link>
                    </p>
                  )
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {i.status !== "PENDING" ? (
                  <span className={i.status === "ACCEPTED" ? "text-green-700" : "text-stone-500"}>{i.status === "ACCEPTED" ? "connected" : i.status.toLowerCase()}</span>
                ) : incoming ? (
                  <>
                    <form action={respondInterest.bind(null, i.id, true)}>
                      <button className="rounded-full bg-maroon px-4 py-1.5 text-white shadow-soft hover:bg-maroon-dark">Accept</button>
                    </form>
                    <form action={respondInterest.bind(null, i.id, false)}>
                      <button className="rounded-full border border-hairline px-4 py-1.5 hover:border-gold">Decline</button>
                    </form>
                  </>
                ) : (
                  <>
                    <span className="text-stone-500">pending</span>
                    <form action={withdrawInterest.bind(null, i.id)}>
                      <button className="text-stone-600 underline">Withdraw</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <section className="pt-6">
        <p className="eyebrow text-gold-dark">Privacy</p>
        <h2 className="mt-1 text-2xl text-maroon">Phone number requests</h2>
        <p className="mt-1 text-sm text-stone-600">Members who asked to see your number. It is shown only if you approve.</p>
        <div className="mt-4">
          <ContactRequestsInbox profileId={profile.id} />
        </div>
      </section>
    </div>
  );
}
