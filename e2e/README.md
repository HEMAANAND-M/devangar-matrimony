# End-to-end tests

Browser suites that sign in as real demo accounts and use the site the way members and staff do.
About 330 checks across 14 suites. They drive a real browser through Playwright and reset the local
database between suites, so **only run them against a local or CI test database, never production.**

They run automatically in GitHub Actions on every push to `main` and on every pull request (see
[CI](#ci) below), and locally on Windows or Linux.

## Requirements

- **Browser:** Microsoft Edge (the default on Windows), or Playwright's bundled Chromium
  (`npx playwright-core install chromium`, the default on Linux and macOS).
- **Shell:** a POSIX shell for the `.sh` helpers (Git Bash on Windows).
- **Database:** PostgreSQL with the database from the main README (`devangar_matrimony`, user
  `postgres`, password `devangar_local`).
- **Demo data:** seeded with `npm run db:seed` in the project folder.

### Settings

All are optional; the defaults match the local setup in the main README.

| Variable | Default | Purpose |
|---|---|---|
| `E2E_BROWSER_CHANNEL` | `msedge` on Windows, bundled Chromium elsewhere | Browser to drive (`msedge`, `chrome`, or empty for bundled Chromium) |
| `PSQL` | newest `C:\Program Files\PostgreSQL\<version>\bin\psql.exe` on Windows, `psql` elsewhere | psql binary used for test setup |
| `E2E_DATABASE_URL` | `postgresql://postgres:devangar_local@localhost:5432/devangar_matrimony` | Database the suites reset and inspect |

## Run everything

**Windows (PowerShell, then Git Bash):**

```powershell
cd e2e
npm install                      # once: installs playwright-core
cd ..
npm run build
.\e2e\serve.ps1 *> server.log    # in a second terminal; keep it running
```

```sh
cd e2e
sh run-all.sh ../server.log
```

**Linux or macOS:**

```sh
(cd e2e && npm install && npx playwright-core install chromium)
npm run build
sh e2e/serve.sh > server.log 2>&1 &
cd e2e && sh run-all.sh ../server.log
```

`run-all.sh` resets test data before each suite and prints one line per suite, with failing checks
listed under it. Run only some suites by naming them: `sh run-all.sh ../server.log smoke chat`. It
exits non-zero if any suite fails, crashes or times out.

The suites read one-time codes from the server log, which is why the log path is passed in.

## CI

`.github/workflows/e2e.yml` runs on `ubuntu-latest` with a `postgres:17` service:

1. Install dependencies.
2. Migrate and seed the database.
3. Build the app.
4. Start it with `e2e/serve.sh`.
5. Install Chromium.
6. Run the default suites.
7. Restart the server with `STAFF_2FA=on` and run `f-auth`.

On failure, the server logs and any screenshots are uploaded as the `e2e-failure` artifact on the run.

## Suites

| Suite | What it covers |
|---|---|
| `smoke` | Registration and OTP, profile creation, photo processing (EXIF removal, WebP), moderation, interests, blocking, password reset, account deletion, security headers |
| `features` | Watermarks, moderator limits, WhatsApp records, demo checkout, Razorpay webhook signatures, ID verification encryption, staff management, family accounts, cron protection |
| `session-cache` | Login and logout through the UI, the Back button after logout, switching accounts |
| `admin-core`, `admin-roles` | Admin dashboard, member search and actions, staff, activity log, exports; moderator and member access limits |
| `b-moderation` | Approvals review, photo duplicates, reports, selfie and ID verification |
| `c-business` | Coupons, checkout, invoices, refunds, announcements, support tickets, content, events, settings |
| `d-member` | Profile form, horoscope upload, match scores, search filters, saved searches, visitors |
| `chat` | Messaging, read receipts, scam warnings, phone-number requests, email preferences, referrals (needs `chat-setup.sql`, which `run-all.sh` applies) |
| `tamil` | Language switch, saved preference, every member page in Tamil at phone width |
| `notme` | "This wasn't me" link from a new-sign-in alert |
| `pwa` | Service worker registration; nothing personal is cached |
| `secactivity` | Security activity list in Settings |
| `emergency` | Admin "Sign out everyone" |

These suites need a differently configured server, so run them on their own:

- **`f-auth`:** staff SMS step, idle timeout and suspension. Start the server with staff two-factor on
  (`$env:STAFF_2FA='on'` in PowerShell, or `STAFF_2FA=on sh e2e/serve.sh`), then
  `sh run-all.sh ../server.log f-auth`.
- **`turnstile`:** the Cloudflare bot check. Start the server with Cloudflare's test keys:
  `TURNSTILE_SITE_KEY=1x00000000000000000000AA`, plus `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
  to pass or `2x0000000000000000000000000000000AA` to fail. Then run `node turnstile.mjs pass` or `fail`.
- **`pwa-offline`:** primes the service worker, waits for you to stop the server, then checks that the
  offline page appears.
- **`crawl`:** opens every link reachable as a visitor, member, moderator and admin, and reports errors:
  `node crawl.mjs ../server.log 150`.
- **`session-cache-https`:** the logout checks behind a simulated HTTPS proxy.
