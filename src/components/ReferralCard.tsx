import { SITE_NAME } from "@/lib/constants";
import { ensureReferralCode, referralLink, referralStats } from "@/lib/referrals";
import { Card } from "./Card";
import { CopyButton } from "./CopyButton";

/** Member's referral code, share link and referral count. Placed on the settings page. */
export async function ReferralCard({ userId }: { userId: string }) {
  const code = await ensureReferralCode(userId);
  const stats = await referralStats(userId);
  const url = referralLink(code);
  const shareText = `I'm using ${SITE_NAME}, a verified matrimony service for our Devanga community. Register free here: ${url}`;
  const btn = "rounded-full border border-gold/60 px-4 py-2 text-sm text-maroon transition hover:border-gold hover:bg-gold-light/30";

  return (
    <Card title="Invite families you know">
      <p className="text-sm text-stone-600">
        Know a Devanga family searching for a match? Share your personal link — every family that joins makes the
        community stronger.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-cream px-4 py-3">
        <span className="eyebrow text-gold-dark">Your code</span>
        <span className="font-mono text-lg font-semibold tracking-[0.2em] text-maroon">{code}</span>
      </div>
      <p className="mt-3 break-all text-xs text-stone-500">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={url} label="Copy link" className={btn} />
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={btn}>
          Share on WhatsApp
        </a>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-hairline p-3 text-center">
          <dt className="text-xs text-stone-500">Joined</dt>
          <dd className="font-display text-3xl font-semibold text-maroon">{stats.joined}</dd>
        </div>
        <div className="rounded-xl border border-hairline p-3 text-center">
          <dt className="text-xs text-stone-500">Profiles approved</dt>
          <dd className="font-display text-3xl font-semibold text-maroon">{stats.approved}</dd>
        </div>
      </dl>
    </Card>
  );
}
