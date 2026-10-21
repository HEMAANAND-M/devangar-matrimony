import { SITE_URL } from "@/lib/site";

/** RFC 9116 security contact, so researchers know how to report a vulnerability. */
export function GET() {
  const contact = process.env.SECURITY_CONTACT_EMAIL ? `mailto:${process.env.SECURITY_CONTACT_EMAIL}` : `${SITE_URL}/support`;
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, ta",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    `Policy: ${SITE_URL}/safety`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
