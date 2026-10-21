# Security

How Devangar Matrimony protects members, and what to strengthen next. To report a vulnerability,
use the contact in `/.well-known/security.txt` (the Support page unless `SECURITY_CONTACT_EMAIL` is
set). Please do not open a public GitHub issue for security problems.

## What is in place

### Accounts and sessions
- Passwords are hashed with bcrypt and must be 8+ characters with a letter and a number.
- Phone numbers are proven by SMS one-time codes: 6 digits, 10-minute expiry, 5 attempts,
  a 60-second resend cooldown and 8 codes per number per day.
- Sessions are signed (HS256) and live in `HttpOnly`, `SameSite=Lax` cookies, `__Host-` prefixed
  over HTTPS. They are revoked on password change, "log out everywhere", suspension or force
  sign-out.
- **Staff** (admins and moderators):
  - Sign-in needs an SMS code after the password, and sessions end after 30 idle minutes.
  - Can be restricted to known IPs with `ADMIN_IP_ALLOWLIST`; outside it, a staff account has no
    staff powers.
- Suspended and banned accounts are refused at sign-in and on every request.
- Sign-in history stores a hashed IP (never the raw address), a device cookie and the browser name;
  members see it in Settings.

### Abuse prevention
- Optional Cloudflare Turnstile bot check on sign-up, login, password reset and the public contact
  form (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`). It fails closed if Cloudflare cannot be reached.
- Postgres-backed rate limits apply to:
  - login (per IP and per number), registration, OTPs and password reset
  - interests, reports, uploads, chat (30 messages a minute), contact requests, support tickets,
    stories and saved searches
- Each account can open 150 profiles a day (premium: 400), which stops bulk harvesting.
- Contact details (phone numbers, emails, links, social handles) are blocked in:
  - profile text and interest messages
  - chat, until a phone-number request is approved
- Automatic moderation flags: contact info, duplicate photos across accounts, devices shared
  between accounts, interest spikes and repeated reports.
- Every staff action is recorded in the activity log with who did it and when.

### Privacy
- Phone numbers are shown to another member only after the owner approves a request.
- Photos:
  - Re-encoded to WebP with EXIF/GPS removed, decompression bombs rejected, and watermarked.
  - Served only through an access-checked route (`private, no-cache`).
  - Blurred until tapped, with save disabled.
- ID documents and selfies are encrypted with AES-256-GCM, viewable only by admins (selfies by
  staff), and deleted on review or after 30 days. Only the last 4 characters of an ID number are kept.
- Horoscopes have their own visibility setting (all members or accepted matches only).
- Moderators never see payments, ID documents or full phone numbers, and phones are masked for
  admins until they choose to reveal them, which is logged.
- Members can delete their account and all personal data; admins can export a member's data as
  JSON for privacy requests. Payment records are kept, unlinked, for tax purposes.

### Web security
- Content Security Policy:
  - A nonce on every request with `strict-dynamic`.
  - `frame-ancestors 'none'`, `object-src 'none'` and `form-action 'self'`.
- Headers: HSTS (preload), `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict `Referrer-Policy`,
  `Permissions-Policy`, COOP and CORP `same-origin`, `X-Permitted-Cross-Domain-Policies: none`.
- Next.js server actions check the request's Origin, so other sites cannot submit them.
- Uploads are checked by file content (magic bytes), not by name or declared type.
- CSV exports are protected against spreadsheet formula injection.
- Payment security:
  - Razorpay checkout and webhooks are verified by HMAC signature.
  - Amounts are checked against the order.
  - Activation is idempotent.
- Cron endpoints need `CRON_SECRET`, compared in constant time.

### Operations
- `npm audit` reports 0 known vulnerabilities in runtime packages. CI runs the audit, typecheck,
  lint and a production build on every push, and Dependabot proposes updates weekly.
- `/api/health` supports uptime monitoring, and errors can be reported to Sentry without member data.
- Backup scripts keep the last 14 daily copies.

## Recommended next steps

Ordered by value for a matrimony site. Items marked **(config)** need no code.

### Before launch
1. **(config)** Set strong, unique secrets in production: `SESSION_SECRET`, `ID_DOC_KEY`,
   `CRON_SECRET` and `PHOTO_STORAGE_KEY`, each 32+ random characters. Never reuse the local ones.
2. **(config)** Keep `STAFF_2FA` on and set `ADMIN_IP_ALLOWLIST` to the office or VPN addresses.
3. **(config)** Turn on daily automated backups at the database host (Neon or Supabase point-in-time
   recovery), and test a restore once.
4. **(config)** Set up an uptime monitor on `/api/health` and Sentry alerts.
5. Publish a privacy policy and terms that meet India's DPDP Act 2023: consent, purpose,
   retention, and a grievance officer contact.
6. Get an external penetration test, or at least an OWASP ZAP baseline scan, of the staging site.

### Strengthen accounts
7. ~~Breached-password check~~: done in 1.0.0.
8. ~~New-device alert~~: done in 1.0.0. A one-tap "this wasn't me" link is still to do.
9. **Passkeys or an authenticator app** for staff instead of SMS codes, which are vulnerable to
   SIM swaps.
10. **Re-authentication** (password or OTP) before sensitive actions: changing phone or email,
    deleting the account, revealing phone numbers in admin.

### Stop fake profiles and scams
11. ~~Bot protection with Cloudflare Turnstile~~: done in 1.2.0. Turn it on with the two keys.
12. **Automatic selfie-to-photo face match** (AWS Rekognition or Azure Face) to pre-screen photo
    verification before staff review.
13. ~~Scam keyword detection in chat~~: done in 1.0.0.
14. **Throttle brand-new accounts** (fewer interests and messages in the first days) until the profile
    is approved and verified.
15. **Disposable-number and VoIP detection** at registration through the SMS provider's lookup API.

### Protect data further
16. **Field-level encryption** of phone numbers and email addresses at rest, with a blind index for
    lookups, so a database leak does not expose contact details.
17. **Signed, short-lived photo URLs** if photos move to a CDN, and per-viewer invisible watermarks
    to trace leaked screenshots.
18. **Least-privilege database users:** a separate read-only role for reporting, and no superuser
    for the app.
19. **Data-retention jobs** for old messages, rejected profiles and closed tickets.

### Detect and respond
20. **Security event log** for members (password changed, new device, number shared), visible in
    Settings.
21. **Alerts to admins** for unusual activity: many failed logins, staff sign-in from a new country,
    bulk exports.
22. **Write an incident-response runbook** covering how to revoke all sessions (bump every
    `sessionVersion`), rotate secrets, notify members and report to CERT-In within 6 hours, as
    Indian law requires.

### Platform upgrades
23. Upgrade to Next.js 16 and Prisma 7 when convenient. Today their advisories are patched with npm
    `overrides` in `package.json`.
24. Use a web application firewall (Vercel Firewall or Cloudflare) with rate rules on `/login`,
    `/register` and `/api/*`.
