# Changelog

All notable changes to Devangar Matrimony. Versions follow [Semantic Versioning](https://semver.org/):
a new major version changes how existing features behave, a minor version adds features, a patch fixes bugs.

## [1.1.1] — 2026-10-21

### Fixed

- **Tamil layout:**
  - Words no longer break mid-word, and the desktop menu no longer overflows (the compact menu is
    used below 1440px).
  - Dashboard figures keep their Tamil labels on a separate line.

## [1.1.0] — 2026-10-21

Tamil language, admin quality-of-life improvements, and fixes found in a full review of payments
and member flows. No database changes.

### Added

- **Tamil (தமிழ்) for the whole member site:**
  - A language switch in the menu and footer. The choice is remembered on the account, so it
    follows the member to new devices.
  - Covers home, sign-in, dashboard, profiles (porutham names included), the profile form, photos,
    verification, search, interests, messages, visitors, settings, Premium and invoices, plus the
    error messages members see.
  - Tamil fonts load only for Tamil pages.
  - Still English: the admin portal, emails, WhatsApp templates and admin-written content
    (FAQ answers, stories, events, announcements).
- **Unread message count** on the Messages menu item.
- **Admin:**
  - A "find a member" search box in the top bar of every page.
  - A Trust & safety panel on the dashboard counting each automatic flag and restricted account,
    linking straight to those members.
  - The integrations list shows whether staff two-factor, the admin IP allowlist and the
    breached-password check are active.
- **[docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md):** a day-to-day guide for the moderation team.

### Fixed

- **Save a search** could hang on "Please wait…" (the search was saved, but the confirmation never
  appeared). Saving now reloads the search with a "Search saved." confirmation.
- **Refunds:** two admins refunding the same payment at the same moment could refund it twice.
- **Coupons:** a coupon could be reused by the same member on every renewal. Each coupon now works
  once per profile.
- **"Verified" label:** shown on every approved profile, it was easy to confuse with real
  verification. It now says "Reviewed".
- **Match panel:** now warns when fewer than half of the poruthams match, so a high preference score
  no longer hides poor star compatibility.
- **Admin charts:** drew an empty grid with repeated "₹0" labels when there was no data.
- **Search performance:** profile cards no longer prefetch every profile page in the results grid,
  which saves a server render per card.

## [1.0.0] — 2026-10-21

The admin portal is rebuilt from a single page into a full back office, and members get chat,
horoscopes, match scores, saved searches and more. The database gains one migration
(`20261020120000_admin_portal_and_member_features`); run `npx prisma migrate deploy` when upgrading.

### Changed — please read

- **Staff accounts land in the admin portal.** Admins and moderators no longer see the
  "create profile" screen after signing in, and get a staff menu instead of the member menu.
- **Staff sign-in needs an SMS code.** After the password, admins and moderators enter a one-time
  code. Set `STAFF_2FA=off` only for local demos.
- **Staff are signed out after 30 minutes of inactivity.**
- **Phone numbers are shared only with permission.** Connected members no longer see each other's
  numbers automatically. A premium member requests the number and it is shown only after the other
  member approves. Staff can still see numbers.
- **Plans are admin-editable.** Prices and durations now come from Admin → Plans & coupons, falling
  back to the original three plans.

### Admin portal

- **Dashboard:**
  - Members, live profiles and sign-ups.
  - Interests sent and accepted.
  - Revenue and premium conversion (admins only).
  - How long the oldest item in each review queue has been waiting.
  - 30-day charts: sign-ups, interests and revenue.
  - Brides-to-grooms balance by city, age bands and marital status.
- **Members:**
  - Search by name, profile ID, phone, email or city.
  - Filters: profile status, account status, gender, premium, ID verified, flagged, join date.
  - Bulk approve and CSV export.
- **Member record:**
  - Every profile field and photo.
  - A timeline of actions, sign-ins, interests, payments, reports and verifications.
  - Devices, with other accounts that used the same device.
  - Family managers, referrals and internal staff notes.
- **Account actions (logged):**
  - Suspend with an end date, ban or reactivate, with a reason; the member is notified.
  - Force sign-out, and reset the password (temporary password shown once).
  - Reveal the phone number.
  - Edit the profile on the member's behalf.
  - Grant premium manually for cash or bank transfers.
  - Mark as married.
  - Export the member's data as JSON, or erase the account.
- **Profile approvals:**
  - One-at-a-time review showing the whole profile, photos, automatic flags and history.
  - Keyboard shortcuts (A approve, R reject, J/K next/previous) and ready-made rejection reasons.
  - A list mode with "approve selected".
- **Photos:** larger previews and rejection with a reason (the member is told why). Bulk approve,
  and warnings when a photo closely matches one on another account.
- **Reports:**
  - Categories (fake profile, harassment, already married, asked for money, inappropriate content).
  - Priority and internal notes.
  - Dismiss, warn or remove, recording who resolved it.
- **Verifications:**
  - ID documents (admins only): encrypted, and deleted after review.
  - New selfie checks shown beside the member's photos, for a "Photo verified" badge.
- **Automatic flags:**
  - contact details in profile text
  - duplicate photos
  - a device shared with another account
  - more than 25 interests in a day
  - 3 or more open reports
- **Payments:**
  - Filters, totals and a failed-payments list.
  - Refunds: through Razorpay when connected, otherwise recorded.
  - Optional premium revocation on refund.
  - CSV export.
- **GST invoices:**
  - Sequential numbers (`DM/2026-27/000001`), with a separate series for demo payments.
  - Printable invoice page with the 18% GST breakdown.
- **Plans & coupons:** edit plan prices and durations, and create percentage or fixed-amount coupons
  with plan limits, use limits and expiry.
- **Communications:**
  - Site-wide announcements targeted at all, free, premium, brides, grooms or staff.
  - A notification log with resend.
  - WhatsApp template usage.
- **Support inbox:** tickets from the contact form, threaded replies and status tracking.
- **Content:**
  - Success stories with photos and publishing.
  - Home-page testimonials, FAQ and the safety page text.
- **Events:** create community events shown on the public Events page.
- **Settings:**
  - Edit dropdown lists: gothrams, sub-sects, cities, education, occupations.
  - Feature switches: payments, WhatsApp, email, ID and photo verification, chat, phone requests,
    registrations.
  - Integration status.
- **Staff:** add or remove moderators, promote to admin (never the last admin), with activity counts.
- **Activity log:** every staff action, filterable, with CSV export.

### Members

- **Richer profiles:**
  - Lagnam, family details (parents' names, family type and status, native place), diet,
    complexion and languages.
  - Sub-sect, gothram and city chosen from lists the admin maintains.
  - The form is grouped into sections with "what to add next" prompts.
- **Partner preferences:**
  - Exclude own gothram (on by default).
  - Preferred stars, dosham, cities and education.
- **Horoscope (jathagam):**
  - Upload as PDF, JPEG, PNG or WebP (up to 5 MB).
  - Choose whether all members or only accepted matches can see it.
  - A South Indian rasi chart showing the Moon sign and lagnam.
- **Match score** (0–100%) on profile cards and a "why you may match" panel on profiles.
- **Search:**
  - New filters: sub-sect, several stars and cities, dosham, education, gothram rule, with photo,
    ID verified, recently active.
  - Sort by best match or recently active.
- **Saved searches** with daily alerts about new matches.
- **Visitors** (premium): who viewed and who shortlisted you.
- **Chat** after an interest is accepted, when at least one of the two members is premium:
  - Read receipts and unread counts.
  - Phone numbers blocked until a contact request is approved.
  - Report or block from the conversation.
- **Phone-number requests:** ask, and the other member approves or declines.
- **Selfie verification** for a "Photo verified" badge, plus phone, ID and photo badges and an
  "active today / this week" indicator.
- **Email notifications** (optional) alongside WhatsApp, with an opt-in in Settings.
- **Referral code and share link** in Settings.
- **Settings:** recent sign-ins with device names.
- **Support:** contact form and ticket threads.
- **Public pages:** Success stories (with a "share your story" form), FAQ and Events.
- **Payments:** coupon codes at checkout, and a payment history with invoice links on the Premium page.

### Security and platform

- **SMS providers:** MSG91 and Twilio (`SMS_PROVIDER`). The OTP page has a resend countdown and
  "wrong number? start again".
- **Suspended and banned accounts** are refused at sign-in and on every request; suspensions lift
  themselves when they expire.
- **Sign-in history:** stored with a hashed IP and a device cookie. Raw IP addresses are not stored.
- **Photo storage:** optional Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Photos are always served through
  the app, so storage URLs never reach browsers.
- **Monitoring and housekeeping:**
  - `/api/health` for uptime monitoring.
  - Optional error reporting to Sentry (`SENTRY_DSN`), without personal data.
  - Daily clean-up of unfinished sign-ups, expired codes and old sign-in records.
  - Daily saved-search alerts.
- **Backups:** `scripts/backup.ps1` and `scripts/backup.sh` (keep the last 14 copies).
- **Accessibility:** visible focus rings, and reduced-motion support.
- **Breached-password check:** passwords found in known data breaches are refused at sign-up,
  reset and change (Have I Been Pwned; only a 5-character hash prefix leaves the server).
- **New-device alert:** members are told on WhatsApp or email when their account signs in from a
  browser it has never used.
- **Scam warnings in chat:** a message asking for money, bank or UPI details, customs fees or
  investments shows the recipient a safety tip, and the sender is flagged for staff.
- **Daily profile-view cap** (150, premium 400) to stop bulk harvesting of profiles and photos.
- **Optional admin IP allowlist** (`ADMIN_IP_ALLOWLIST`): outside it, staff accounts have no staff
  powers.
- **Security headers and contact:** extra headers (`Cross-Origin-Resource-Policy`,
  `X-Permitted-Cross-Domain-Policies`, `Origin-Agent-Cluster`), and `/.well-known/security.txt`
  for vulnerability reports.
- **Dependency fixes:**
  - Upgraded `sharp` to 0.35.5 (image-library CVEs) and `@vercel/blob` to 2.8.2.
  - Patched `postcss` and `deepmerge-ts` through npm overrides.
  - `npm audit` reports 0 vulnerabilities.
- **CI:** a GitHub Actions workflow (audit, typecheck, lint, build against Postgres) and Dependabot.
- [SECURITY.md](SECURITY.md) documents every protection and a prioritised list of next steps.

### Fixed

- Admin "create profile" screen after staff login.
- Refund button offered on complimentary (₹0) payments.
- Announcement banner was read out by screen readers as a status update, masking form confirmations.

## [0.3.1] — 2026-10-20

### Fixed

- **Logout did not end the session on HTTPS.** The secure cookie was not actually deleted.
- **Login failed when the site was opened by network address over plain HTTP** (for example from a
  phone on the same Wi-Fi).
- **Browser Back after logout showed the previous member's pages.**
- **Deleting an account sometimes landed on Login instead of the confirmation.**

## [0.3.0] — 2026-10-20

### Added

- Premium plans with Razorpay checkout and a no-charge demo mode.
- ID verification: Aadhaar, PAN, passport, voter ID or driving licence. Only the last 4 characters
  are kept, and the document is encrypted and deleted after review.
- Photo watermarking, and photo viewing that discourages screenshots.
- Family co-managed accounts: parents or siblings can manage a profile by invitation.
- A moderator role, separate from admin.
- WhatsApp notifications through the WhatsApp Cloud API, with opt-in.

## [0.2.0] — 2026-10-20

### Added

- Thirumana porutham (10 compatibility checks) on profiles.
- "Recently viewed your profile", block and unblock, profile hiding.
- Password reset, change password and "log out everywhere".
- PWA manifest, share image, sitemap and robots file.

### Security

- Nonce-based Content Security Policy and strict security headers.
- Rate limits on every sign-in, OTP and messaging flow.
- Photos re-encoded with location data removed.
- Sessions revoked on password change.

## [0.1.0] — 2026-10-20

### Added

- First version:
  - Registration with OTP.
  - Profile creation and admin approval.
  - Photo upload.
  - Search with filters.
  - Interests, shortlist and admin moderation.
- Premium maroon-and-gold design.
- GitHub Codespaces demo.
