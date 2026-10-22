# Incident response runbook

Use this when you suspect member data has been exposed, an account or the server has been
compromised, or the site is being abused (spam wave, fake-profile flood, scam campaign). Work
through the steps in order, and write down what you did and when as you go.

## 1. Contain (first 30 minutes)

| Situation | Do this |
|---|---|
| A staff account may be compromised | Admin → Staff: remove the moderator (or demote the admin). Then Admin → Settings → **Emergency: sign out everyone**. |
| Member sessions or passwords may be exposed | Admin → Settings → **Emergency: sign out everyone**. Everyone signs in again. |
| One member account is compromised | On their record: **Force sign-out**, then **Reset password**, and tell them through a trusted channel. |
| A feature is being abused (chat spam, phone requests, fake sign-ups) | Admin → Settings → **Feature switches**: turn it off. It takes effect on the next page load. |
| A wave of fake accounts | Turn off **New registrations**. Set the Turnstile keys if they are not set yet. Suspend the accounts from the Members page (filter by flag). |
| Server secrets may be leaked | Rotate the secrets (step 2). |

## 2. Rotate secrets

Change these in the hosting dashboard (Vercel → Project → Settings → Environment Variables), then
redeploy:

- `SESSION_SECRET`: signs everyone out and invalidates sign-in links. **Do not** change it without also
  setting `DATA_ENCRYPTION_KEY`, `ID_DOC_KEY` and `PHOTO_STORAGE_KEY` explicitly, because they fall back to keys derived from it.
- `DATA_ENCRYPTION_KEY`: **never rotate it by simply changing the value.** Every stored phone number and
  email is encrypted with it, so a new value makes them all unreadable and nobody can log in. If the
  key itself leaked: take a database backup, then write a re-key script that decrypts each value
  with the old key and re-encrypts it, and recomputes the `phoneHash` and `emailHash` columns, with
  the new key (model it on `scripts/encrypt-contacts.ts`). Test it on a copy, then swap the key and
  run it in one maintenance window. If `DATA_ENCRYPTION_KEY` is unset, the key derives from
  `SESSION_SECRET`, so the same caution applies to that secret.
- `ID_DOC_KEY`: only if it was leaked. Documents waiting for review that were encrypted with the
  old key can no longer be opened, so ask those members to upload again.
- `CRON_SECRET`, `RAZORPAY_*`, `WHATSAPP_TOKEN`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`,
  `MSG91_AUTH_KEY` / `TWILIO_*`, `TURNSTILE_SECRET_KEY`: rotate in each provider's dashboard first,
  then update them here.
- The database password: rotate it at the database host, then update `DATABASE_URL`.

## 3. Investigate

- **Admin → Activity log:** filter by staff member and date. Every staff action is recorded, including
  phone reveals and exports.
- **Member record → Devices:** sign-ins and other accounts sharing a device.
- **Hosting logs and Sentry** (if `SENTRY_DSN` is set): unusual errors, request spikes and failed
  logins.
- **Database:** check the `LoginEvent`, `AdminLog` and `Notification` tables for the affected period.

## 4. Report (legal deadlines)

- **CERT-In:** India requires cyber security incidents to be reported to CERT-In **within 6 hours** of
  noticing them (CERT-In Directions, April 2022). Report at https://www.cert-in.org.in.
- **Data Protection Board / affected members:** under the DPDP Act 2023, a personal-data breach must
  be reported to the Data Protection Board and to each affected member, saying what happened, what
  data was involved and what they should do. Get legal advice on the current rules and timelines.
- **Razorpay:** if payment flows are involved, tell Razorpay support.

## 5. Recover and learn

- Restore from backup if data was altered (see "Backups" in README.md), and test the restore on a copy
  first.
- Re-enable features one at a time, watching the dashboard's Trust & safety panel.
- Within a week, write a short summary: what happened, how it was found, what was done, and what
  will change. Add follow-up work to SECURITY.md under "Recommended next steps".
