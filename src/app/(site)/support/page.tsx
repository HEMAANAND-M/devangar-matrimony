import Link from "next/link";
import { createTicket } from "@/app/actions/support";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { TextArea, TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="We are here to help"
        title="Help & support"
        subtitle={<>Questions about your profile, payments or safety? Write to us and our team will reply within one working day. You may also find an answer in the <Link href="/faq" className="text-maroon underline decoration-gold/50 underline-offset-4">FAQ</Link>.</>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Send us a message">
          <ActionForm action={createTicket} className="space-y-4">
            {!user && (
              <>
                <TextField label="Your name" name="name" required maxLength={80} autoComplete="name" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" hint="So we can call or WhatsApp you back" />
                  <TextField label="Email" name="email" type="email" autoComplete="email" />
                </div>
              </>
            )}
            <TextField label="Subject" name="subject" required maxLength={140} placeholder="e.g. My profile is still under review" />
            <TextArea label="How can we help?" name="message" required rows={6} maxLength={4000} />
            <p className="text-xs text-stone-500">Please never share passwords or OTPs — our team will never ask for them.</p>
            <SubmitButton>Send message</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          {user && (
            <Card title="Your requests">
              {tickets.length ? (
                <ul className="divide-y divide-hairline">
                  {tickets.map((t) => {
                    const [text, cls] = STATUS[t.status];
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
                <p className="text-sm text-stone-600">You have not contacted support yet.</p>
              )}
            </Card>
          )}
          <Card title="Stay safe">
            <ul className="space-y-2 text-sm text-stone-700">
              <li>Never send money to anyone you met here.</li>
              <li>Report suspicious profiles from their profile page.</li>
            </ul>
            <Link href="/safety" className="mt-4 inline-block text-sm text-maroon underline decoration-gold/50 underline-offset-4">Read our safety guidelines</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
