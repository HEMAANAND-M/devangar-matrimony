#!/bin/sh
# POSIX version of serve.ps1: starts the built app with the demo/test settings the suites expect.
# Run `npm run build` first, and send the output to a log the suites can read one-time codes from:
#   sh e2e/serve.sh > server.log 2>&1 &
cd "$(dirname "$0")/.."
export SMS_PROVIDER="${SMS_PROVIDER:-console-test}"
export PAYMENTS_DEMO="${PAYMENTS_DEMO:-true}"
export RAZORPAY_WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-test_webhook_secret}"
export CRON_SECRET="${CRON_SECRET:-test_cron_secret}"
export PWNED_PASSWORD_CHECK="${PWNED_PASSWORD_CHECK:-off}"
export STAFF_2FA="${STAFF_2FA:-off}"
exec npx next start -p "${PORT:-3000}"
