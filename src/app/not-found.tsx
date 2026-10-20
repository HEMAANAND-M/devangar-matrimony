import Link from "next/link";
import { Mandala } from "@/components/Ornaments";
import { SiteChrome } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <SiteChrome>
    <div className="relative mx-auto max-w-xl overflow-hidden py-20 text-center">
      <Mandala className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 text-gold opacity-15" />
      <div className="relative">
        <p className="eyebrow text-gold-dark">Page not found</p>
        <h1 className="mt-3 text-6xl text-maroon">404</h1>
        <p className="mt-4 text-stone-600">
          This page doesn’t exist, or the profile is no longer available.
        </p>
        <Link href="/" className="mt-8 inline-block rounded-full bg-maroon px-8 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark">
          Back to home
        </Link>
      </div>
    </div>
    </SiteChrome>
  );
}
