import type { Metadata } from "next";
import Link from "next/link";
import { AdminSidebar, type AdminNavGroup } from "@/components/admin/AdminSidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Devangar Matrimony" }, robots: { index: false } };

/** Counts shown as badges in the sidebar: work waiting for staff. */
async function queueCounts(isAdmin: boolean) {
  const [profiles, photos, reports, selfies, ids, tickets] = await Promise.all([
    db.profile.count({ where: { status: "PENDING" } }),
    db.photo.count({ where: { approved: false } }),
    db.report.count({ where: { resolved: false } }),
    db.idVerification.count({ where: { status: "PENDING", docType: "SELFIE" } }),
    isAdmin ? db.idVerification.count({ where: { status: "PENDING", docType: { not: "SELFIE" } } }) : 0,
    db.supportTicket.count({ where: { status: "OPEN" } }),
  ]);
  return { profiles, photos, reports, verifications: selfies + ids, tickets };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const counts = await queueCounts(isAdmin);

  const groups: AdminNavGroup[] = [
    { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: "overview" }] },
    {
      title: "Moderation",
      items: [
        { href: "/admin/approvals", label: "Profile approvals", icon: "approvals", count: counts.profiles },
        { href: "/admin/photos", label: "Photos", icon: "photos", count: counts.photos },
        { href: "/admin/reports", label: "Reports", icon: "reports", count: counts.reports },
        { href: "/admin/verifications", label: "Verifications", icon: "verify", count: counts.verifications },
      ],
    },
    {
      title: "Members",
      items: [
        { href: "/admin/members", label: "Members", icon: "members" },
        { href: "/admin/support", label: "Support inbox", icon: "support", count: counts.tickets },
      ],
    },
    ...(isAdmin
      ? ([
          {
            title: "Business",
            items: [
              { href: "/admin/payments", label: "Payments", icon: "payments" },
              { href: "/admin/coupons", label: "Plans & coupons", icon: "coupons" },
            ],
          },
          {
            title: "Engagement",
            items: [
              { href: "/admin/communications", label: "Communications", icon: "comms" },
              { href: "/admin/campaigns", label: "Campaigns", icon: "comms" },
              { href: "/admin/ads", label: "Advertisements", icon: "content" },
              { href: "/admin/content", label: "Content", icon: "content" },
              { href: "/admin/events", label: "Events", icon: "events" },
            ],
          },
          {
            title: "System",
            items: [
              { href: "/admin/staff", label: "Staff", icon: "staff" },
              { href: "/admin/activity", label: "Activity log", icon: "activity" },
              { href: "/admin/settings", label: "Settings", icon: "settings" },
            ],
          },
        ] satisfies AdminNavGroup[])
      : []),
  ];

  const sidebar = (
    <>
      <Link href="/admin" className="flex items-center gap-3 px-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-dark font-display text-lg font-semibold text-maroon-dark">D</span>
        <span>
          <span className="block font-display text-lg leading-tight text-white">Devangar</span>
          <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-gold-light/80">{isAdmin ? "Admin portal" : "Moderation"}</span>
        </span>
      </Link>
      <div className="mt-8">
        <AdminSidebar groups={groups} />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#f6f3ee]">
      <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-maroon-dark to-[#2c0712] lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto px-3 py-6">{sidebar}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <details className="group relative lg:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-lg border border-hairline p-2 text-maroon [&::-webkit-details-marker]:hidden" aria-label="Admin menu">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-gradient-to-b from-maroon-dark to-[#2c0712] px-3 py-6 shadow-lift">{sidebar}</div>
          </details>
          <p className="hidden text-sm text-stone-500 md:block">
            <span className="font-medium text-ink">{isAdmin ? "Administrator" : "Moderator"}</span>
            <span className="hidden xl:inline"> · {maskPhone(staff.phone)}</span>
          </p>
          <form action="/admin/members" method="get" role="search" className="ml-2 min-w-0 flex-1 md:max-w-sm">
            <label className="sr-only" htmlFor="admin-search">Find a member</label>
            <input
              id="admin-search"
              name="q"
              type="search"
              placeholder="Find a member — name, DM code or phone"
              className="w-full rounded-lg border border-hairline bg-cream/60 px-3 py-1.5 text-sm placeholder:text-stone-400 focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-stone-600 transition hover:bg-sand hover:text-maroon">View site</Link>
            <SignOutButton className="rounded-lg border border-hairline px-3 py-1.5 text-sm text-stone-600 transition hover:border-gold hover:text-maroon">Sign out</SignOutButton>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
