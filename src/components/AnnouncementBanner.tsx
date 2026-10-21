import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { isPremium } from "@/lib/premium";
import { getCurrentUser, isStaff } from "@/lib/session";
import { DismissibleAnnouncements } from "./DismissibleAnnouncements";

/** Site-wide announcements configured in Admin → Communications, filtered to the viewer's audience. */
export async function AnnouncementBanner() {
  const now = new Date();
  const [user, list] = await Promise.all([
    getCurrentUser(),
    db.announcement.findMany({
      where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      select: { id: true, title: true, body: true, href: true, audience: true },
      orderBy: { startsAt: "desc" },
      take: 3,
    }),
  ]);
  if (!list.length) return null;
  const profile = user?.profile;
  const matches = (audience: string) => {
    switch (audience) {
      case "all": return true;
      case "free": return !!profile && !isPremium(profile);
      case "premium": return isPremium(profile);
      case "male": return profile?.gender === "MALE";
      case "female": return profile?.gender === "FEMALE";
      case "staff": return !!user && isStaff(user);
      default: return false;
    }
  };
  const items = list.filter((a) => matches(a.audience)).map((a) => ({ id: a.id, title: a.title, body: a.body, href: a.href }));
  if (!items.length) return null;
  const t = await getT();
  return <DismissibleAnnouncements items={items} learnMore={t("announce.learnMore")} dismissLabel={t("announce.dismiss", { title: "{title}" })} />;
}
