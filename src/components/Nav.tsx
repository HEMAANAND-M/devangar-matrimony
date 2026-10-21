import Link from "next/link";
import { unreadCount } from "@/lib/chat";
import { isPremium } from "@/lib/premium";
import { getCurrentUser, isStaff } from "@/lib/session";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const user = await getCurrentUser();
  // Staff accounts without a member profile only work in the admin portal.
  const staffOnly = !!user && isStaff(user) && !user.profile;
  const unread = user?.profile ? await unreadCount(user.profile.id) : 0;
  const links: [string, string, number?][] = staffOnly
    ? [["/admin", user.role === "ADMIN" ? "Admin portal" : "Moderation portal"]]
    : user
    ? [
        ["/dashboard", "Dashboard"],
        ["/search", "Search"],
        ["/interests", "Interests"],
        ["/shortlist", "Shortlist"],
        ["/messages", "Messages", unread],
        ["/profile/edit", "My profile"],
        ["/settings", "Settings"],
        ...(isStaff(user) ? ([["/admin", user.role === "ADMIN" ? "Admin" : "Moderation"]] as [string, string][]) : []),
      ]
    : [];

  const signedOut = (
    <>
      <Link href="/login" className="px-3 py-2 text-sm text-stone-700 hover:text-maroon">Log in</Link>
      <Link
        href="/register"
        className="rounded-full bg-maroon px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark"
      >
        Register free
      </Link>
    </>
  );
  const upgrade = user?.profile && !isPremium(user.profile) && (
    <Link href="/upgrade" className="rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-dark px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:brightness-105">
      Upgrade
    </Link>
  );
  const logoutButton = (
    <SignOutButton className="rounded-full border border-hairline px-4 py-2 text-sm text-stone-600 transition hover:border-gold hover:text-maroon">
      Log out
    </SignOutButton>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-cream/85 backdrop-blur-md">
      <div className="h-1 bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark" />
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href={staffOnly ? "/" : user ? "/dashboard" : "/"} className="mr-auto" aria-label="Devangar Matrimony home">
          <Logo />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-4 xl:gap-5 lg:flex">
          <NavLinks links={links} />
        </div>
        <div className="hidden items-center gap-2 lg:flex">{user ? <>{upgrade}{logoutButton}</> : signedOut}</div>

        {/* Mobile */}
        <details className="group relative lg:hidden">
          <summary className="flex cursor-pointer list-none items-center rounded-full border border-hairline p-2.5 text-maroon [&::-webkit-details-marker]:hidden" aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" className="group-open:hidden" />
              <path d="M6 6l12 12M18 6L6 18" className="hidden group-open:block" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-3 flex w-64 flex-col gap-1 rounded-2xl border border-hairline bg-white p-4 shadow-lift">
            <NavLinks links={links} />
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">{user ? <>{upgrade}{logoutButton}</> : signedOut}</div>
          </div>
        </details>
      </nav>
    </header>
  );
}
