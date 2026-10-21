import Link from "next/link";
import type { Photo, Profile } from "@prisma/client";
import { ageFrom, heightLabel, photoUrl } from "@/lib/format";
import { type MatchProfile, matchScore } from "@/lib/match";
import { isPremium } from "@/lib/premium";
import { ActiveIndicator, IdVerifiedBadge, MatchBadge, PhotoVerifiedBadge, PremiumBadge } from "./Badges";

export type CardProfile = Profile & { photos: Photo[]; user?: { lastActiveAt: Date | null } };

const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * `photo` is the primary photo the viewer may see, already access-checked. Pass `viewer` to show
 * a match score.
 */
export function ProfileCard({ profile, photo, viewer }: { profile: CardProfile; photo?: Photo; viewer?: MatchProfile }) {
  const match = viewer ? matchScore(viewer, profile) : null;
  const isNew = Date.now() - profile.createdAt.getTime() < NEW_FOR_MS;
  const photoHidden = !photo && profile.photos.some((ph) => ph.approved);
  const height = profile.heightCm ? heightLabel(profile.heightCm)?.split(" (")[0] : null;
  return (
    <Link
      href={`/profiles/${profile.code}`}
      className="group overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lift"
    >
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-br from-sand to-gold-light/60">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
          <img
            src={photoUrl(photo.id, "thumb")}
            loading="lazy"
            decoding="async"
            draggable={false}
            alt={profile.name}
            className="pointer-events-none h-full w-full select-none object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="font-display text-7xl font-medium text-gold/70">{profile.name.charAt(0)}</span>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          {isNew ? (
            <span className="eyebrow rounded-full bg-white/90 px-2.5 py-1 !text-[0.6rem] text-maroon shadow-sm backdrop-blur">New</span>
          ) : (
            <span />
          )}
          <span
            className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[0.65rem] font-medium text-emerald-800 shadow-sm backdrop-blur"
            title="Mobile verified and profile reviewed"
          >
            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden>
              <path d="M10 1.5l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L10 18.5l-2.2-1.6-2.7.1-.9-2.6L2 12.8l.8-2.6L2 7.6l2.2-1.6.9-2.6 2.7.1L10 1.5zm-1 11.3l5-5-1.2-1.2L9 10.4 7.2 8.6 6 9.8l3 3z" />
            </svg>
            Reviewed
          </span>
        </div>
        {photoHidden && (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-ink/80 to-transparent px-2 pb-2.5 pt-8 text-center text-xs text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 018 0v3" />
            </svg>
            Photo visible on acceptance
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-display text-xl font-semibold leading-tight text-ink transition group-hover:text-maroon">{profile.name}</p>
        <p className="mt-0.5 text-xs tracking-wide text-gold-dark">{profile.code}</p>
        {(match || isPremium(profile) || profile.idVerifiedAt || profile.photoVerifiedAt) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {match && <MatchBadge score={match.score} small />}
            {isPremium(profile) && <PremiumBadge small />}
            {profile.idVerifiedAt && <IdVerifiedBadge small />}
            {profile.photoVerifiedAt && <PhotoVerifiedBadge small />}
          </div>
        )}
        <div className="my-3 h-px bg-hairline" />
        <p className="text-sm text-stone-700">
          {ageFrom(profile.dateOfBirth)} yrs{height ? ` · ${height}` : ""}
          {profile.star ? ` · ${profile.star}` : ""}
        </p>
        <p className="mt-1 truncate text-sm text-stone-500">{profile.occupation}</p>
        <p className="mt-1 truncate text-sm text-stone-500">{profile.city}</p>
        <ActiveIndicator lastActiveAt={profile.user?.lastActiveAt} className="mt-2" />
      </div>
    </Link>
  );
}

/** Primary visible photo for list views, honouring the target's photo privacy. */
export function cardPhoto(p: CardProfile, connectedIds: Set<string> = new Set()): Photo | undefined {
  if (p.photoVisibility === "ACCEPTED_ONLY" && !connectedIds.has(p.id)) return undefined;
  const approved = p.photos.filter((ph) => ph.approved);
  return approved.find((ph) => ph.isPrimary) ?? approved[0];
}
