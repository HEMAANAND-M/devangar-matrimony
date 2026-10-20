import "server-only";
import { SITE_NAME } from "./constants";
import { SITE_URL } from "./site";

export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

/** Sends through the Resend HTTP API (https://resend.com). Throws on a non-2xx response. */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Email ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Branded transactional email: maroon header, one message, an optional button. Inline styles only,
 * since most mail clients strip <style> blocks.
 */
export function renderEmail({ heading, lines, cta }: { heading: string; lines: string[]; cta?: { label: string; href: string } }) {
  const html = `<!doctype html><html><body style="margin:0;background:#faf7f1;font-family:Helvetica,Arial,sans-serif;color:#1e1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e0d3;border-radius:16px;overflow:hidden">
<tr><td style="background:#5e1229;padding:20px 28px;color:#e9dcc3;font-family:Georgia,serif;font-size:20px;letter-spacing:.5px">${escape(SITE_NAME)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#5e1229">${escape(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d3833">${escape(l)}</p>`).join("")}
${cta ? `<p style="margin:24px 0 8px"><a href="${escape(cta.href)}" style="display:inline-block;background:#5e1229;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600">${escape(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e8e0d3;font-size:12px;color:#8a8178">You are receiving this because email updates are on in your settings. <a href="${SITE_URL}/settings" style="color:#8a6a3b">Manage notifications</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, "", ...lines, ...(cta ? ["", `${cta.label}: ${cta.href}`] : []), "", `Manage notifications: ${SITE_URL}/settings`].join("\n");
  return { html, text };
}
