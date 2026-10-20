export type Plan = {
  id: string;
  name: string;
  months: number;
  /** Price in paise (₹1 = 100 paise), GST inclusive. */
  amount: number;
  tagline: string;
  featured?: boolean;
  /** Inactive plans are hidden from checkout but still name past payments. */
  active?: boolean;
};

/**
 * Default membership plans. Admins can edit plans in Admin → Plans & coupons; server code reads the
 * live list with getPlans() from lib/plans.ts.
 */
export const PLANS: readonly Plan[] = [
  { id: "gold-3", name: "Gold", months: 3, amount: 1999_00, tagline: "Start your search" },
  { id: "gold-6", name: "Gold Plus", months: 6, amount: 2999_00, tagline: "Most families choose this", featured: true },
  { id: "gold-12", name: "Gold Annual", months: 12, amount: 4999_00, tagline: "Best value" },
];

export const findPlan = (id: string, plans: readonly Plan[] = PLANS) => plans.find((p) => p.id === id);

export const FREE_DAILY_INTERESTS = 5;
export const PREMIUM_DAILY_INTERESTS = 30;

export const PREMIUM_BENEFITS = [
  "Chat with members who accept your interest",
  "Request contact numbers",
  "See who viewed and shortlisted you",
  `Send up to ${PREMIUM_DAILY_INTERESTS} interests a day (free: ${FREE_DAILY_INTERESTS})`,
  "Gold Premium badge on your profile",
  "Priority review of your profile and photos",
];

export function isPremium(profile: { premiumUntil: Date | null } | null | undefined, now = new Date()): boolean {
  return !!profile?.premiumUntil && profile.premiumUntil > now;
}

export const dailyInterestLimit = (profile: { premiumUntil: Date | null }) =>
  isPremium(profile) ? PREMIUM_DAILY_INTERESTS : FREE_DAILY_INTERESTS;

/** New end date: extends from the current end if still active, otherwise from now. */
export function extendPremium(current: Date | null, months: number, now = new Date()): Date {
  const base = current && current > now ? new Date(current) : new Date(now);
  base.setMonth(base.getMonth() + months);
  return base;
}

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
