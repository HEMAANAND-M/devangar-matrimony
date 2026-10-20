import Link from "next/link";
import { Badge } from "@/components/admin/ui";
import { FLAG_INFO } from "@/lib/flags";

export const PROFILE_REJECT_REASONS = [
  "Contact details in profile text",
  "Incomplete or unclear details",
  "Not from the Devangar community",
  "Duplicate account",
  "Inappropriate content",
  "Fake or suspicious profile",
];

export const PHOTO_REJECT_REASONS = [
  "Face not clearly visible",
  "Group photo",
  "Contains text or contact details",
  "Low quality or blurry",
  "Not a photo of the member",
  "Inappropriate",
];

export const ID_REJECT_REASONS = [
  "Blurry or unreadable",
  "Name doesn't match the profile",
  "Full Aadhaar uploaded — please use masked Aadhaar",
  "Expired document",
  "Last 4 digits don't match",
];

export const SELFIE_REJECT_REASONS = [
  "Face not clearly visible",
  "Doesn't match the profile photos",
  "Photo of a photo or screen",
  "Face covered (sunglasses, mask)",
];

/** "3 min", "5 h", "2 d": how long an item has been waiting. */
export function waited(since: Date, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - since.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export function FlagBadges({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f} title={FLAG_INFO[f]?.detail ?? f}>
          <Badge tone="red">⚑ {FLAG_INFO[f]?.label ?? f}</Badge>
        </span>
      ))}
    </span>
  );
}

export function FlagList({ flags }: { flags: string[] }) {
  if (!flags.length) return <p className="text-sm text-stone-500">No automatic flags.</p>;
  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={f} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-sm">
          <p className="font-medium text-red-800">⚑ {FLAG_INFO[f]?.label ?? f}</p>
          <p className="text-xs text-red-700/80">{FLAG_INFO[f]?.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <nav className="mb-5 flex gap-1 border-b border-hairline" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${
            t.key === active ? "border-maroon font-medium text-maroon" : "border-transparent text-stone-500 hover:text-ink"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-sand px-1.5 text-[0.7rem] tabular-nums text-stone-600">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
