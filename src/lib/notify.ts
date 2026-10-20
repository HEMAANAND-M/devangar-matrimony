import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { SITE_URL } from "./site";

/**
 * WhatsApp Cloud API templates. Each must be created and approved in Meta Business Manager with
 * the same name, language "en" and body variables in this order.
 */
export const TEMPLATES = {
  interest_received: ["name", "fromCode", "link"],
  interest_accepted: ["name", "byCode", "link"],
  profile_approved: ["name", "link"],
  weekly_matches: ["name", "count", "link"],
} as const;
export type Template = keyof typeof TEMPLATES;

export const whatsappConfigured = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

async function sendWhatsApp(phone: string, template: Template, params: string[]) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Delivers one recorded notification and stores the outcome. */
export async function deliver(notificationId: string) {
  const n = await db.notification.findUnique({ where: { id: notificationId }, include: { user: { select: { phone: true } } } });
  if (!n || n.status !== "PENDING") return;
  if (!whatsappConfigured()) {
    console.log(`[WhatsApp:not-configured] ${n.template} → ${n.user.phone}`, n.params);
    await db.notification.update({ where: { id: n.id }, data: { status: "NOT_CONFIGURED" } });
    return;
  }
  try {
    await sendWhatsApp(n.user.phone, n.template as Template, n.params as string[]);
    await db.notification.update({ where: { id: n.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (e) {
    await db.notification.update({ where: { id: n.id }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
  }
}

/**
 * Queues a WhatsApp template for everyone who manages a profile (owner and family members) and
 * has opted in. Sending happens after the response so the member never waits on WhatsApp.
 */
export async function notifyProfile(profileId: string, template: Template, params: Record<string, string>) {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { user: { select: { id: true, whatsappOptIn: true } }, managers: { select: { user: { select: { id: true, whatsappOptIn: true } } } } },
  });
  if (!profile) return;
  const recipients = [profile.user, ...profile.managers.map((m) => m.user)].filter((u) => u.whatsappOptIn);
  if (!recipients.length) return;

  const ordered = TEMPLATES[template].map((key) => params[key] ?? "");
  const created = await Promise.all(
    recipients.map((u) => db.notification.create({ data: { userId: u.id, template, params: ordered } })),
  );
  after(() => Promise.all(created.map((n) => deliver(n.id))));
}

export const link = (path: string) => `${SITE_URL}${path}`;
