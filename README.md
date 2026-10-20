# Devangar Matrimony

Matrimony web app for the Devangar (Devanga) community. Built with Next.js 15 (App Router), PostgreSQL, Prisma and Tailwind CSS.

![Devangar Matrimony home page](docs/screenshots/home.png)

## Live demo (runs on GitHub)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/HEMAANAND-M/devangar-matrimony?quickstart=1)

1. Click the button above (you need a GitHub account; personal accounts include free Codespaces hours).
2. Wait 2–3 minutes while the Codespace installs packages, creates the database and loads demo data.
3. The app opens in a new browser tab. If it doesn't, open the **Ports** tab and click the globe icon next to port 3000.
4. Log in with a demo account (type the 10-digit number):

| Role         | Mobile                    | Password     |
| ------------ | ------------------------- | ------------ |
| Admin        | `9000000000`              | `admin12345` |
| Demo brides  | `9000000100` – `9000000102` | `demo12345`  |
| Demo grooms  | `9000000103` – `9000000105` | `demo12345`  |
| Moderator    | `9000000001`              | `moderator123` |

`DM90005` (Demo Karthik) is a Premium member and `DM90002` / `DM90005` are ID-verified, so the badges are visible in the demo.

When you register a new account, the OTP is printed in the Codespace **terminal** (no SMS is sent in the demo).

To stop using free hours, stop the Codespace from <https://github.com/codespaces> when you are done.

## Screenshots

| Login | Register | Mobile |
| ----- | -------- | ------ |
| ![Login](docs/screenshots/login.png) | ![Register](docs/screenshots/register.png) | ![Mobile home](docs/screenshots/home-mobile.png) |

## Features

**Matchmaking**
- Registration with mobile number + password and OTP verification; password reset by OTP
- Detailed profiles: gothram, kuladeivam, sub-sect, star, rasi, dosham, birth details, education, family, partner preferences
- **Thirumana porutham** — 10-porutham star compatibility (Dinam, Ganam, Mahendram, Stree Deergham, Yoni, Rajju, Vedhai, Rasi, Rasi Adhipathi, Vasyam) on every profile
- Search by age, height, star, rasi, dosham, mother tongue, marital status, city, education, gothram exclusion and profile ID
- Recommended matches, **who viewed my profile**, and a profile-strength meter on the dashboard
- Send / accept / decline / withdraw interests; contact number revealed only after acceptance
- Shortlist, hide/unhide profile, report and **block** members
- Admin panel: approve/reject profiles and photos, handle reports, moderation activity log
- Installable on phones (PWA), branded link previews for WhatsApp / social sharing

**Membership & trust**
- **Premium plans via Razorpay** (3 / 6 / 12 months): contact numbers of accepted matches, 30 interests a day (free: 5), gold Premium badge. Signature-verified checkout plus an idempotent webhook; no-charge demo checkout until keys are added
- **ID verification**: Aadhaar (masked), PAN, Passport, Voter ID or Driving licence. Only the last 4 characters are stored; the document is AES-256-GCM encrypted, admin-only, and deleted on review (or after 30 days)
- **Family accounts**: a parent or sibling manages the profile with their own login (invite bound to their OTP-verified number, up to 2)
- **Moderator role**: staff can moderate profiles, photos and reports without access to payments, ID documents, phone numbers or staff management
- **WhatsApp notifications** (Cloud API, opt-in): interest received, interest accepted, profile approved, weekly new-matches digest
- **Photo protection**: watermark burned into every photo; profile photos blurred until tapped, re-blurred when the app loses focus, right-click/long-press save disabled

**Security & privacy**
- Nonce-based Content Security Policy, HSTS, frame blocking and other security headers
- Postgres-backed rate limiting on login, registration, OTP, password reset, reports and uploads (works across serverless instances)
- Sessions in signed `HttpOnly` / `SameSite` cookies (`__Host-` prefixed in production), revocable via password change or "log out of all devices"
- Photos re-encoded on upload: **EXIF/GPS location stripped**, decompression bombs rejected, served only through an access-checked route
- Contact details (phone numbers, emails, social handles) blocked in profile text and interest messages
- Account deletion that removes all personal data (DPDP Act right to erasure)

**Performance**
- WebP photos resized to 1200px plus 480px thumbnails for cards, with ETag caching
- Image bytes stored apart from photo metadata so lists never load them
- Per-request user caching, parallel queries and targeted database indexes
- Skeleton loading states and self-hosted fonts

## Setup

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npx prisma migrate dev --name init
npm run db:seed             # admin account + 6 demo profiles
npm run dev
```

Open http://localhost:3000.

Seeded logins (development only):

| Role  | Mobile           | Password     |
| ----- | ---------------- | ------------ |
| Admin | +919000000000    | admin12345   |
| Demo  | +919000000100–105 | demo12345   |

Log in with the 10-digit number (e.g. `9000000000`).

### OTP in development

No SMS provider is wired up yet. The OTP is printed in the terminal running `npm run dev`:

```
[OTP] +919876543210: 123456
```

To send real SMS, implement `deliverSms` in `src/lib/otp.ts` (MSG91, Twilio, Fast2SMS…) and set `SMS_PROVIDER`. Production refuses to send OTPs until this is configured.

## Payments, WhatsApp and scheduled jobs

| Setting | Where to get it |
| --- | --- |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Account & Settings → API Keys (use Test keys first) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks → add `https://<your-domain>/api/razorpay/webhook` with events `order.paid`, `payment.captured`, `payment.failed` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Meta for Developers → WhatsApp → API Setup (use a permanent System User token in production) |
| `CRON_SECRET` | Any long random string; `vercel.json` runs `/api/cron/weekly` every Monday 09:00 IST |

Plan prices live in `src/lib/premium.ts`.

Create these WhatsApp message templates (category **Utility**, language **English**) in Meta Business Manager; the variables are filled in this order:

| Template name | Example body |
| --- | --- |
| `interest_received` | Hello {{1}}, you have a new interest from profile {{2}} on Devangar Matrimony. View it here: {{3}} |
| `interest_accepted` | Good news {{1}}! Profile {{2}} accepted your interest. View the profile: {{3}} |
| `profile_approved` | Hello {{1}}, your Devangar Matrimony profile is now live. Start searching: {{2}} |
| `weekly_matches` | Hello {{1}}, {{2}} new profiles matching your preferences joined this week: {{3}} |

Until WhatsApp is configured, messages are recorded with status "not configured" and visible to admins.

## Project layout

```
prisma/schema.prisma      data model
prisma/seed.ts            admin + demo data
src/app/actions/          server actions (auth, profile, interactions, admin)
src/app/api/photos/[id]   authenticated photo delivery
src/lib/                  session, OTP, access rules, helpers
src/components/           shared UI
```

## Next steps before launch

- Real SMS provider for OTP (MSG91, Twilio, Fast2SMS…)
- In-app chat between connected members
- Email/SMS notifications for new interests
- Object storage (S3/R2) for photos once the member base grows
- Terms of service, privacy policy and compliance with India's DPDP Act 2023
