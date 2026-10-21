# Admin portal guide

For the team that runs Devangar Matrimony day to day. Sign in at `/login` with a staff account. You
will be asked for a code sent by SMS, then land in the admin portal. You are signed out after
30 minutes without activity.

## Roles

| | Moderator | Admin |
|---|---|---|
| Review profiles, photos, reports, selfie checks | ✓ | ✓ |
| Support inbox, member records and staff notes (read-only actions) | ✓ | ✓ |
| ID documents | | ✓ |
| Suspend, ban, reset password, edit profiles, grant premium, erase accounts | | ✓ |
| Payments, refunds, plans, coupons | | ✓ |
| Announcements, content, events, settings, staff, activity log | | ✓ |

Phone numbers are masked everywhere. Admins can reveal one on a member's record, and every reveal
is recorded in the activity log.

## Daily routine (about 15 minutes)

1. **Dashboard:** the "Waiting for the team" strip shows each queue and how long its oldest item has
   waited. It turns red after a day. Aim to clear everything daily: families judge us by how fast
   profiles go live.
2. **Profile approvals:** review one at a time. Check the photos, that the details are complete, and
   the Automatic checks box. Keyboard: **A** approve, **R** write a rejection reason, **J / →** next,
   **K / ←** previous, **Ctrl + Enter** send the rejection. Always give a clear reason; the member
   sees it.
3. **Photos:** reject group photos, photos of someone else, celebrity or stock images, and anything
   with phone numbers. "Possible duplicate" means the photo closely matches one on another account,
   which is often a sign of a fake profile.
4. **Reports:** handle "high" priority first (harassment, asking for money). Add internal notes as
   you investigate. "Warn" records a warning; "Remove profile" hides it from everyone. To suspend
   or ban, open the member's record.
5. **Verifications:** for selfies, approve only if it is clearly the same person as the photos. ID
   documents are deleted the moment you decide.
6. **Support inbox:** reply to open tickets, and mark them resolved when done.

## Trust & safety signals

The dashboard's Trust & safety panel counts automatic flags. Click one to see the members:

- **Contact details:** phone numbers, emails or social handles in the profile text.
- **Duplicate photo:** the same photo is on another account.
- **Shared device:** signed in from a browser another account also uses (one family managing two
  profiles is normal; ten accounts on one device is not).
- **Interest spike:** more than 25 interests sent in a day.
- **Many reports:** 3 or more open reports.
- **Scam language:** chat messages about money transfers, bank or UPI details, customs fees or
  investments. The recipient is automatically shown a safety tip.

## Common tasks

- **A member paid in cash or by bank transfer:** open their record and use **Grant premium** with the
  amount received and a note. It is recorded as an offline payment with an invoice.
- **Refund:** Payments, then **Refund** on the payment. With Razorpay connected, the money is
  returned automatically; otherwise it is only recorded. Tick "Also remove premium" if the
  membership should end.
- **Festival offer:** Plans & coupons, then create a coupon (percentage or fixed amount, optional
  plan limit, maximum uses and expiry). Each member can use a coupon once.
- **Member found their match:** on their record, change the status to **Married**. They leave
  search and count as a success story. Invite them to share their story on the Stories page.
- **Privacy request:** on the member's record, **Export data** gives a JSON file of everything we
  hold. **Erase account** deletes the account permanently; payment records are kept, without the
  name, for tax purposes.
- **Something is being abused:** Settings, Feature switches turns off chat, phone requests,
  registrations or payments instantly for everyone.
- **Suspected breach:** Settings, **Emergency: sign out everyone**, then follow
  [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). CERT-In must be told within 6 hours.
- **Tell everyone something:** Communications, then a new announcement. You can target free or
  premium members, brides or grooms.

## Good practice

- Never ask members for passwords or one-time codes, and never share a member's phone number
  outside the app.
- Use staff notes on a member's record for anything the next person should know.
- Everything you do is recorded in the activity log, which protects you and the members.
