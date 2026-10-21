import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { emailConfigured, renderEmail, sendEmail } from "./email";
import { featureEnabled } from "./settings";
import { SITE_URL } from "./site";

/**
 * WhatsApp Cloud API templates. Each must be created and approved in Meta Business Manager with
 * the same name, language "en" and body variables in this order. The same keys drive email.
 */
export const TEMPLATES = {
  interest_received: ["name", "fromCode", "link"],
  interest_accepted: ["name", "byCode", "link"],
  profile_approved: ["name", "link"],
  weekly_matches: ["name", "count", "link"],
  profile_rejected: ["name", "reason", "link"],
  photo_rejected: ["name", "reason", "link"],
  id_verified: ["name", "link"],
  photo_verified: ["name", "link"],
  premium_activated: ["name", "until", "link"],
  message_received: ["name", "fromCode", "link"],
  contact_request: ["name", "fromCode", "link"],
  contact_approved: ["name", "byCode", "link"],
  saved_search_matches: ["name", "count", "search", "link"],
  ticket_reply: ["name", "subject", "link"],
  account_suspended: ["name", "reason"],
  new_sign_in: ["device", "time", "link"],
} as const;
export type Template = keyof typeof TEMPLATES;

type Copy = { subject: string; heading: string; lines: string[]; cta?: string };

/** Email wording for each template; `p` holds the template's named parameters. */
const EMAIL_COPY: { [K in Template]: (p: Record<string, string>) => Copy } = {
  interest_received: (p) => ({ subject: `New interest from ${p.fromCode}`, heading: `${p.name}, someone is interested`, lines: [`Member ${p.fromCode} has sent you an interest.`, "Have a look at their profile and respond when you're ready."], cta: "View interest" }),
  interest_accepted: (p) => ({ subject: `${p.byCode} accepted your interest`, heading: "Your interest was accepted", lines: [`Good news, ${p.name}: member ${p.byCode} accepted your interest.`, "You can now see their photos and start a conversation."], cta: "View profile" }),
  profile_approved: (p) => ({ subject: "Your profile is live", heading: `Welcome, ${p.name}`, lines: ["Your profile has been reviewed and is now visible to members.", "Add more photos and details to get better matches."], cta: "Go to dashboard" }),
  weekly_matches: (p) => ({ subject: `${p.count} new matches this week`, heading: "Your weekly matches", lines: [`${p.name}, we found ${p.count} new profiles that match your preferences.`], cta: "See matches" }),
  profile_rejected: (p) => ({ subject: "Your profile needs a few changes", heading: "Please update your profile", lines: [`${p.name}, our team couldn't approve your profile yet.`, `Reason: ${p.reason}`, "Make the changes and it will be reviewed again."], cta: "Edit profile" }),
  photo_rejected: (p) => ({ subject: "A photo was not approved", heading: "Photo not approved", lines: [`${p.name}, one of your photos couldn't be approved.`, `Reason: ${p.reason}`, "Clear, recent photos of just you get the best response."], cta: "Manage photos" }),
  id_verified: (p) => ({ subject: "Your ID is verified", heading: "ID verified", lines: [`${p.name}, your ID has been verified. Your profile now shows the verified badge.`], cta: "View profile" }),
  photo_verified: (p) => ({ subject: "Your photos are verified", heading: "Photo verified", lines: [`${p.name}, your selfie matched your profile photos. Your profile now shows the photo-verified badge.`], cta: "View profile" }),
  premium_activated: (p) => ({ subject: "Premium is active", heading: "Welcome to Premium", lines: [`Thank you, ${p.name}. Your Premium membership is active until ${p.until}.`], cta: "Start searching" }),
  message_received: (p) => ({ subject: `New message from ${p.fromCode}`, heading: "You have a new message", lines: [`${p.name}, member ${p.fromCode} sent you a message.`], cta: "Read message" }),
  contact_request: (p) => ({ subject: `${p.fromCode} asked for your phone number`, heading: "Phone number request", lines: [`${p.name}, member ${p.fromCode} would like your phone number.`, "It is shared only if you approve."], cta: "Respond" }),
  contact_approved: (p) => ({ subject: `${p.byCode} shared their phone number`, heading: "Phone number shared", lines: [`${p.name}, member ${p.byCode} approved your request. Their number is now on their profile.`], cta: "View number" }),
  saved_search_matches: (p) => ({ subject: `${p.count} new profiles for “${p.search}”`, heading: "New matches for your saved search", lines: [`${p.name}, ${p.count} new profiles match your saved search “${p.search}”.`], cta: "See profiles" }),
  ticket_reply: (p) => ({ subject: `Re: ${p.subject}`, heading: "Our team replied", lines: [`${p.name}, we've replied to your request “${p.subject}”.`], cta: "Read reply" }),
  new_sign_in: (p) => ({ subject: "New sign-in to your account", heading: "Was this you?", lines: [`Your account was signed in to from ${p.device} on ${p.time}.`, "If this wasn't you, change your password and choose “Log out of all devices” in Settings straight away."], cta: "Review sign-ins" }),
  account_suspended: (p) => ({ subject: "Your account has been suspended", heading: "Account suspended", lines: [`${p.name}, your account has been suspended.`, `Reason: ${p.reason}`, "If you think this is a mistake, reply to this email or contact support."] }),
};

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

function namedParams(template: Template, ordered: string[]): Record<string, string> {
  return Object.fromEntries(TEMPLATES[template].map((key, i) => [key, ordered[i] ?? ""]));
}

/** Delivers one recorded notification on its channel and stores the outcome. */
export async function deliver(notificationId: string) {
  const n = await db.notification.findUnique({ where: { id: notificationId }, include: { user: { select: { phone: true, email: true } } } });
  if (!n || n.status !== "PENDING") return;
  const template = n.template as Template;
  const params = n.params as string[];

  const configured = n.channel === "EMAIL" ? emailConfigured() && !!n.user.email : n.channel === "WHATSAPP" ? whatsappConfigured() : false;
  if (!configured || !(template in TEMPLATES)) {
    console.log(`[${n.channel}:not-configured] ${n.template} → ${n.channel === "EMAIL" ? n.user.email : n.user.phone}`, params);
    await db.notification.update({ where: { id: n.id }, data: { status: "NOT_CONFIGURED" } });
    return;
  }
  try {
    if (n.channel === "EMAIL") {
      const p = namedParams(template, params);
      const copy = EMAIL_COPY[template](p);
      const { html, text } = renderEmail({ heading: copy.heading, lines: copy.lines, cta: copy.cta && p.link ? { label: copy.cta, href: p.link } : undefined });
      await sendEmail({ to: n.user.email!, subject: copy.subject, html, text });
    } else {
      await sendWhatsApp(n.user.phone, template, params);
    }
    await db.notification.update({ where: { id: n.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
  } catch (e) {
    await db.notification.update({ where: { id: n.id }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
  }
}

type Recipient = { id: string; whatsappOptIn: boolean; emailOptIn: boolean; email: string | null };
const RECIPIENT_SELECT = { id: true, whatsappOptIn: true, emailOptIn: true, email: true } as const;

/** Records one notification per opted-in channel per recipient, then sends after the response. */
async function queue(recipients: Recipient[], template: Template, params: Record<string, string>) {
  if (!recipients.length) return;
  const [whatsapp, email] = await Promise.all([featureEnabled("whatsapp"), featureEnabled("email")]);
  const ordered = TEMPLATES[template].map((key) => params[key] ?? "");
  const rows = recipients.flatMap((u) => [
    ...(whatsapp && u.whatsappOptIn ? [{ userId: u.id, template, params: ordered, channel: "WHATSAPP" as const }] : []),
    ...(email && u.emailOptIn && u.email ? [{ userId: u.id, template, params: ordered, channel: "EMAIL" as const }] : []),
  ]);
  if (!rows.length) return;
  const created = await Promise.all(rows.map((data) => db.notification.create({ data })));
  after(() => Promise.all(created.map((n) => deliver(n.id))));
}

/**
 * Queues a template for everyone who manages a profile (owner and family members), on each channel
 * they have opted into. Sending happens after the response so the member never waits on it.
 */
export async function notifyProfile(profileId: string, template: Template, params: Record<string, string>) {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { user: { select: RECIPIENT_SELECT }, managers: { select: { user: { select: RECIPIENT_SELECT } } } },
  });
  if (!profile) return;
  await queue([profile.user, ...profile.managers.map((m) => m.user)], template, params);
}

/** Same as notifyProfile for a single account, e.g. a support reply to someone without a profile. */
export async function notifyUser(userId: string, template: Template, params: Record<string, string>) {
  const user = await db.user.findUnique({ where: { id: userId }, select: RECIPIENT_SELECT });
  if (user) await queue([user], template, params);
}

export const link = (path: string) => `${SITE_URL}${path}`;
