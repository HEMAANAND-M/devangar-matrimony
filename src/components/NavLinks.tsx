"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: [href: string, label: string, count?: number][] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map(([href, label, count]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative px-1 py-2 text-sm transition-colors after:absolute after:inset-x-1 after:-bottom-px after:h-px after:origin-center after:bg-gold after:transition-transform ${
              active ? "text-maroon after:scale-x-100" : "text-stone-600 after:scale-x-0 hover:text-maroon hover:after:scale-x-100"
            }`}
          >
            {label}
            {!!count && (
              <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-maroon px-1 text-[0.65rem] font-semibold leading-[1.1rem] text-white" aria-label={`${count} unread`}>
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
