import Link from "next/link";
import { PageHeader } from "@/components/Card";
import { cardPhoto } from "@/components/ProfileCard";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { isPremium } from "@/lib/premium";
import { withPhotos } from "@/lib/queries";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";
import { signedPhotoUrl } from "@/lib/photo-url";

export const metadata = { title: "Messages" };

function when(d: Date) {
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function MessagesPage() {
  const { profile } = await requireProfile();
  const [enabled, interests] = await Promise.all([
    featureEnabled("chat"),
    db.interest.findMany({
      where: { status: "ACCEPTED", OR: [{ fromId: profile.id }, { toId: profile.id }] },
      include: {
        from: { include: withPhotos },
        to: { include: withPhotos },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: { where: { readAt: null, senderId: { not: profile.id } } } } },
      },
    }),
  ]);

  const conversations = interests
    .map((i) => ({
      id: i.id,
      other: i.fromId === profile.id ? i.to : i.from,
      last: i.messages[0] ?? null,
      unread: i._count.messages,
      at: i.messages[0]?.createdAt ?? i.updatedAt,
    }))
    .filter((c) => c.other.status === "APPROVED")
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const anyPremium = isPremium(profile) || conversations.some((c) => isPremium(c.other));
  const t = await getT();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={t("chat.eyebrow")} title={t("chat.title")} subtitle={t("chat.subtitle")} />

      {!enabled && (
        <p className="mb-4 rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-stone-600">{t("msg.chatDisabled")}</p>
      )}
      {enabled && !anyPremium && conversations.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gradient-to-r from-cream to-gold-light/30 px-5 py-4 text-sm">
          <p className="text-stone-700">{t("chat.premiumBanner")}</p>
          <Link href="/upgrade" className="rounded-full bg-maroon px-5 py-2 text-xs font-medium text-white shadow-soft hover:bg-maroon-dark">{t("chat.upgrade")}</Link>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white px-6 py-14 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-gold-dark" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5h16v11H8l-4 4V5z" /></svg>
          </div>
          <h2 className="text-2xl text-maroon">{t("chat.empty")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">{t("chat.emptyBody")}</p>
          <Link href="/search" className="mt-6 inline-block rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("chat.findMatches")}</Link>
        </div>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
          {conversations.map((c) => {
            const photo = cardPhoto(c.other, new Set([c.other.id]));
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-cream sm:px-5">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sand to-gold-light/60">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
                      <img src={signedPhotoUrl(photo.id, "thumb")} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-xl text-gold-dark">{c.other.name.charAt(0)}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate ${c.unread ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                        {c.other.name} <span className="text-xs font-normal text-stone-500">{c.other.code}</span>
                      </span>
                      <span className="shrink-0 text-xs text-stone-500">{when(c.at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${c.unread ? "text-ink" : "text-stone-500"}`}>
                        {c.last ? `${c.last.senderId === profile.id ? t("chat.you") : ""}${c.last.body}` : t("chat.sayHello")}
                      </span>
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-maroon px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-white">{c.unread}</span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
