# End-to-end tests

Browser suites that sign in as real demo accounts and use the site the way members and staff do.
About 330 checks across 14 suites. They drive Microsoft Edge through Playwright and reset the local
database between suites, so **only run them against a local development database, never production.**

## Requirements

- Windows with Microsoft Edge, and Git Bash (for the `.sh` helpers).
- PostgreSQL 17 at `C:\Program Files\PostgreSQL\17\bin\psql.exe`, with the database from the main README
  (`devangar_matrimony`, user `postgres`, password `devangar_local`). Edit `sql.sh` if yours differs.
- The demo data seeded (`npm run db:seed` in the project folder).

## Run everything

```powershell
cd e2e
npm install                      # once: installs playwright-core
cd ..
npm run build
.\e2e\serve.ps1 *> server.log    # in a second terminal; keep it running
```

```sh
cd e2e
sh run-all.sh "C:\path\to\devangar-matrimony\server.log"
```

`run-all.sh` resets test data before each suite and prints one line per suite, with failing checks
listed under it. Run just some suites by naming them: `sh run-all.sh server.log smoke chat`.

The suites read one-time codes from the server log, which is why the log path is passed in.

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

Suites that need a differently configured server, run on their own:

- `f-auth`: staff SMS step, idle timeout, suspension. Start the server with `$env:STAFF_2FA='on'` first.
- `turnstile`: Cloudflare bot check. Start with the Cloudflare test keys
  (`TURNSTILE_SITE_KEY=1x00000000000000000000AA`, and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
  to pass or `2x0000000000000000000000000000000AA` to fail), then run `node turnstile.mjs pass` or `fail`.
- `pwa-offline`: primes the service worker, then waits for you to stop the server, and checks the
  offline page appears.
- `crawl`: opens every link reachable as a visitor, member, moderator and admin, and reports errors:
  `node crawl.mjs server.log 150`.
- `session-cache-https`: the logout checks behind a simulated HTTPS proxy.
