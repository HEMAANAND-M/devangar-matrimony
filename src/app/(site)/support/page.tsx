import Link from "next/link";
import { createTicket } from "@/app/actions/support";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { TextArea, TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { type TKey, getT } from "@/lib/i18n";
import { Turnstile } from "@/components/Turnstile";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata = { title: "Help & support", description: "Contact the Devangar Matrimony support team." };

const STATUS: Record<string, [string, string]> = {
  OPEN: ["Awaiting our reply", "bg-amber-50 text-amber-800"],
  PENDING: ["We replied", "bg-emerald-50 text-emerald-800"],
  RESOLVED: ["Resolved", "bg-sand text-stone-600"],
};

export default async function SupportPage() {
  const user = await getCurrentUser();
  const tickets = user
    ? await db.supportTicket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 20 })
    : [];
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const tr = await getT();
  const siteKey = turnstileSiteKey();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={tr("support.eyebrow")}
        title={tr("support.title")}
        subtitle={<>{tr("support.subtitle")} <Link href="/faq" className="text-maroon underline decoration-gold/50 underline-offset-4">{tr("support.faq")}</Link>.</>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title={tr("support.send")}>
          <ActionForm action={createTicket} className="space-y-4">
            {!user && (
              <>
                <TextField label={tr("support.name")} name="name" required maxLength={80} autoComplete="name" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={tr("support.mobile")} name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" hint={tr("support.mobileHint")} />
                  <TextField label={tr("support.email")} name="email" type="email" autoComplete="email" />
                </div>
              </>
            )}
            <TextField label={tr("support.subject")} name="subject" required maxLength={140} placeholder={tr("support.subjectPlaceholder")} />
            <TextArea label={tr("support.message")} name="message" required rows={6} maxLength={4000} />
            <p className="text-xs text-stone-500">{tr("support.never")}</p>
            {!user && siteKey && <Turnstile siteKey={siteKey} />}
            <SubmitButton>{tr("support.sendButton")}</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          {user && (
            <Card title={tr("support.requests")}>
              {tickets.length ? (
                <ul className="divide-y divide-hairline">
                  {tickets.map((t) => {
                    const [, cls] = STATUS[t.status];
                    const text = tr(`support.status.${t.status}` as TKey);
                    return (
                      <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/support/${t.id}`} className="block text-sm font-medium text-ink hover:text-maroon">{t.subject}</Link>
                        <p className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                          <span className={`rounded-full px-2 py-0.5 ${cls}`}>{text}</span>
                          {fmt(t.updatedAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-stone-600">{tr("support.noRequests")}</p>
              )}
            </Card>
          )}
          <Card title={tr("support.staySafe")}>
            <ul className="space-y-2 text-sm text-stone-700">
              <li>{tr("support.safe1")}</li>
              <li>{tr("support.safe2")}</li>
            </ul>
            <Link href="/safety" className="mt-4 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4">{tr("support.safetyLink")}</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
