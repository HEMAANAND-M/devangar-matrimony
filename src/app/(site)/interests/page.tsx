import Link from "next/link";
import { respondInterest, withdrawInterest } from "@/app/actions/interactions";
import { Card, PageHeader } from "@/components/Card";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { isPremium } from "@/lib/premium";
import { isStaff, requireProfile } from "@/lib/session";

export const metadata = { title: "Interests" };

export default async function InterestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireProfile();
  const premium = isPremium(profile) || isStaff(user);
  const tab = (await searchParams).tab === "sent" ? "sent" : "received";

  const interests = await db.interest.findMany({
    where: tab === "sent" ? { fromId: profile.id } : { toId: profile.id },
    include: { from: { include: { user: { select: { phone: true } } } }, to: { include: { user: { select: { phone: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const tabCls = (t: string) =>
    `rounded-full px-5 py-2 text-sm transition ${tab === t ? "bg-maroon text-white shadow-soft" : "text-stone-600 hover:text-maroon"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Your connections" title="Interests" subtitle="Contact details are shared once an interest is accepted." />
      <div className="inline-flex gap-1 rounded-full border border-hairline bg-white p-1 shadow-soft">
        <Link href="/interests" className={tabCls("received")}>Received</Link>
        <Link href="/interests?tab=sent" className={tabCls("sent")}>Sent</Link>
      </div>
      {interests.length === 0 && <p className="text-stone-600">Nothing here yet.</p>}
      {interests.map((i) => {
        const other = tab === "sent" ? i.to : i.from;
        return (
          <Card key={i.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/profiles/${other.code}`} className="font-semibold text-maroon hover:underline">
                  {other.name} ({other.code})
                </Link>
                <p className="text-sm text-stone-600">
                  {ageFrom(other.dateOfBirth)} yrs · {other.occupation} · {other.city}
                </p>
                {i.message && <p className="mt-2 text-sm italic text-stone-700">“{i.message}”</p>}
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
              <div className="flex items-center gap-2 text-sm">
                {i.status !== "PENDING" ? (
                  <span className={i.status === "ACCEPTED" ? "text-green-700" : "text-stone-500"}>{i.status.toLowerCase()}</span>
                ) : tab === "received" ? (
                  <>
                    <form action={respondInterest.bind(null, i.id, true)}>
                      <button className="rounded-full bg-maroon px-4 py-1.5 shadow-soft text-white">Accept</button>
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
    </div>
  );
}
