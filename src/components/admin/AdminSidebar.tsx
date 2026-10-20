"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

const ICONS = {
  overview: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z",
  members: "M16 11a4 4 0 10-8 0M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  approvals: "M9 12l2 2 4-4M5 4h14v16H5z",
  photos: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5",
  reports: "M5 21V4h11l-1.5 4L16 12H5",
  verify: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4",
  payments: "M3 7h18v10H3zM3 10h18M7 15h3",
  coupons: "M4 8a2 2 0 002-2h12a2 2 0 002 2v8a2 2 0 00-2 2H6a2 2 0 00-2-2V8zM10 9v6",
  comms: "M4 5h16v11H8l-4 4V5z",
  support: "M12 20a8 8 0 100-16 8 8 0 000 16zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01",
  content: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5",
  events: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  staff: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1M18 8h4M20 6v4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
} as const;

export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${active ? "text-gold-light" : "text-white/50"}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={ICONS[item.icon]} />
                    </svg>
                    <span className="flex-1">{item.label}</span>
                    {!!item.count && (
                      <span className="rounded-full bg-gold px-1.5 py-px text-[0.65rem] font-semibold tabular-nums text-maroon-dark">
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
