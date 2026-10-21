import Link from "next/link";
import { requestContact } from "@/app/actions/contact";
import { acceptedInterestBetween } from "@/lib/chat";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { isPremium } from "@/lib/premium";
import { featureEnabled } from "@/lib/settings";
import { ActionForm, SubmitButton } from "./ActionForm";

/**
 * Shown on another member's profile: request their phone number, or show it once approved.
 * The number belongs to the profile's own account (not a family manager's).
 */
export async function ContactRequestPanel({ viewerProfileId, targetProfileId }: { viewerProfileId: string; targetProfileId: string }) {
  if (viewerProfileId === targetProfileId || !(await featureEnabled("contactRequests"))) return null;
  const [viewer, target, connected, request] = await Promise.all([
    db.profile.findUnique({ where: { id: viewerProfileId }, select: { premiumUntil: true } }),
    db.profile.findUnique({ where: { id: targetProfileId }, select: { name: true, user: { select: { phone: true } } } }),
    acceptedInterestBetween(viewerProfileId, targetProfileId),
    db.contactRequest.findUnique({ where: { fromId_toId: { fromId: viewerProfileId, toId: targetProfileId } } }),
  ]);
  if (!viewer || !target) return null;
  const first = target.name.split(" ")[0];
  const t = await getT();

  const box = "rounded-xl border border-gold/40 bg-cream p-4 text-sm";
  if (request?.status === "APPROVED") {
    const phone = target.user.phone;
    return (
      <div className={box}>
        <p className="eyebrow text-gold-dark">{t("contact.phone")}</p>
        <a href={`tel:${phone}`} className="mt-1 block text-lg font-semibold tracking-wide text-maroon">{phone}</a>
        <a
          href={`https://wa.me/${phone.replace(/^\+/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4"
        >
          {t("contact.whatsapp")}
        </a>
        <p className="mt-2 text-xs text-stone-500">{t("contact.approved", { name: first })}</p>
      </div>
    );
  }
  if (!connected) {
    return <p className="text-xs text-stone-500">{t("contact.afterAccept", { name: first })}</p>;
  }
  if (request?.status === "PENDING") {
    return (
      <div className={box}>
        <p className="font-medium text-ink">{t("contact.requested")}</p>
        <p className="mt-1 text-stone-600">{t("contact.waiting", { name: first })}</p>
      </div>
    );
  }
  if (request?.status === "DECLINED") {
    return (
      <div className={box}>
        <p className="text-stone-600">{t("contact.declined", { name: first })}</p>
      </div>
    );
  }
  if (!isPremium(viewer)) {
    return (
      <div className={box}>
        <p className="text-stone-700">
          {t("contact.phoneLabel")} <span className="font-medium tracking-widest text-stone-400 blur-[3px]" aria-hidden>+91 98XXX XXXXX</span>
        </p>
        <Link href="/upgrade" className="mt-3 inline-block rounded-full bg-maroon px-5 py-2 text-xs font-medium text-white shadow-soft hover:bg-maroon-dark">
          {t("contact.upgrade")}
        </Link>
      </div>
    );
  }
  return (
    <ActionForm action={requestContact.bind(null, targetProfileId)} className={box}>
      <p className="text-stone-700">{t("contact.ask", { name: first })}</p>
      <SubmitButton className="mt-3 w-full">{t("contact.request")}</SubmitButton>
    </ActionForm>
  );
}
