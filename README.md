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
- Razorpay premium plans (e.g. contact views limited to paid members)
- In-app chat between connected members
- Email/SMS notifications for new interests
- Object storage (S3/R2) for photos once the member base grows
- Terms of service, privacy policy and compliance with India's DPDP Act 2023
