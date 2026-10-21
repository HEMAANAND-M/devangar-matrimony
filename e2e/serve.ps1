# Starts the production server with the demo/test settings the e2e suites expect.
# Run `npm run build` in the project folder first. Pipe the output to a log file: the suites read
# one-time codes from it, e.g.  .\e2e\serve.ps1 *> server.log
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$env:SMS_PROVIDER = 'console-test'
$env:PAYMENTS_DEMO = 'true'
$env:RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret'
$env:CRON_SECRET = 'test_cron_secret'
$env:PWNED_PASSWORD_CHECK = 'off'
if (-not $env:STAFF_2FA) { $env:STAFF_2FA = 'off' }
Set-Location (Join-Path $PSScriptRoot "..")
npm start
