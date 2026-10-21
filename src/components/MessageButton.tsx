import Link from "next/link";
import { acceptedInterestBetween, chatBlockReason } from "@/lib/chat";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";

/** "Message" link on a profile, shown when the two members can chat (accepted interest). */
export async function MessageButton({ viewerProfileId, targetProfileId }: { viewerProfileId: string; targetProfileId: string }) {
  if (viewerProfileId === targetProfileId) return null;
  const interest = await acceptedInterestBetween(viewerProfileId, targetProfileId);
  if (!interest) return null;
  const [me, other] = await Promise.all([
    db.profile.findUnique({ where: { id: viewerProfileId }, select: { id: true, status: true, premiumUntil: true } }),
    db.profile.findUnique({ where: { id: targetProfileId }, select: { id: true, status: true, premiumUntil: true } }),
  ]);
  if (!me || !other) return null;
  const block = await chatBlockReason(interest.status, me, other);
  if (block === "disabled" || block === "blocked" || block === "not_approved") return null;
  const t = await getT();

  return block === "premium" ? (
    <Link
      href="/upgrade"
      className="flex w-full items-center justify-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-sm font-medium text-maroon transition hover:bg-gold-light/30"
    >
      {t("contact.upgradeToMessage")}
    </Link>
  ) : (
    <Link
      href={`/messages/${interest.id}`}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M4 5h16v11H8l-4 4V5z" /></svg>
      {t("contact.message")}
    </Link>
  );
}
