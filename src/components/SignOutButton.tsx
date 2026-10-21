"use client";

import { useTransition } from "react";
import { logout, logoutEverywhere } from "@/app/actions/auth";

/**
 * Signs out, then loads the destination as a fresh document. A client-side transition would keep
 * Next.js's in-memory page cache, so Back could show the previous member's pages.
 */
export function SignOutButton({
  everywhere = false,
  className,
  children,
  pendingLabel = "Signing out…",
}: {
  everywhere?: boolean;
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await (everywhere ? logoutEverywhere() : logout());
          window.location.replace(everywhere ? "/login" : "/");
        })
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
