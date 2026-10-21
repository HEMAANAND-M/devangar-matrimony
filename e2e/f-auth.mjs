// Agent F checks: referral capture, verify-page UX, start over, sign-in history, health and cron
// endpoints, suspension / ban, staff SMS second step and staff idle timeout.
// Uses throwaway numbers +9198765000xx only, so it never disturbs the shared seed accounts.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3106";
const LOG = process.argv[3];
const PSQL = "C:/Program Files/PostgreSQL/17/bin/psql.exe";
const DB = "postgresql://postgres:devangar_local@localhost:5432/devangar_matrimony";
const sql = (q) => execFileSync(PSQL, ["-d", DB, "-tAc", q]).toString().trim();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

function readLog() {
  const buf = fs.readFileSync(LOG);
  return buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");
}
async function otpFor(phone, sinceLen) {
  for (let i = 0; i < 40; i++) {
    const text = readLog().slice(sinceLen);
    const all = [...text.matchAll(new RegExp(`\\[OTP\\] \\${phone}: (\\d{6})`, "g"))];
    if (all.length) return all.at(-1)[1];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no OTP for ${phone}`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(180000);
page.setDefaultTimeout(60000);
const settle = () => page.waitForLoadState("networkidle").catch(() => {});
const alertText = () => page.locator("main [role=alert]").first().innerText({ timeout: 10000 }).catch(() => "");

async function registerAndVerify(local, query = "") {
  await page.goto(`${BASE}/register${query}`);
  await settle();
  await page.fill('input[name="phone"]', local);
  await page.fill('input[name="password"]', "test12345");
  await page.fill('input[name="confirm"]', "test12345");
  await page.check('input[name="terms"]');
  const mark = readLog().length;
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/verify/, { timeout: 180000 });
  await settle();
  return mark;
}
async function enterOtp(phone, mark) {
  const code = await otpFor(phone, mark);
  await page.fill('input[name="code"]', code);
  await page.click('main form button[type="submit"]');
}
async function loginForm(local, password = "test12345") {
  await page.goto(`${BASE}/login`);
  await settle();
  await page.fill('input[name="phone"]', local);
  await page.fill('input[name="password"]', password);
  const mark = readLog().length;
  await page.click('main button[type="submit"]');
  return mark;
}

const P1 = "+919876500001", P2 = "+919876500002", P3 = "+919876500003";
let savedRef = null;
try {
  sql(`DELETE FROM "User" WHERE phone LIKE '+91987650000%'`);
  sql(`DELETE FROM "RateLimit" WHERE key LIKE 'register:ip:%' OR key LIKE '%9876500%'`);
  // Referral: reuse the referrer's code if one exists, otherwise set a temporary one.
  savedRef = sql(`SELECT COALESCE("referralCode", '') FROM "User" WHERE phone = '+919000000100'`);
  const code = savedRef || "FTESTREF";
  if (!savedRef) sql(`UPDATE "User" SET "referralCode" = 'FTESTREF' WHERE phone = '+919000000100'`);

  const mark = await registerAndVerify("9876500001", `?ref=${code}`);
  const body = await page.locator("main").innerText();
  check("Verify page shows the masked number", body.includes("+91 98••••••01"), body.match(/\+91 [^.]*/)?.[0]);
  check("Resend button shows a countdown", /Resend code in \d+s/.test(body));
  check("Wrong number? Start again is offered", /Wrong number\?/.test(body));
  await enterOtp(P1, mark);
  await page.waitForURL(/\/profile\/edit/, { timeout: 180000 });
  check("OTP verification lands on profile creation", true);
  const referred = sql(`SELECT u."referredById" = r.id FROM "User" u, "User" r WHERE u.phone = '${P1}' AND r.phone = '+919000000100'`);
  check("Referral code recorded on the new account", referred === "t", referred);

  await page.goto(`${BASE}/settings`);
  await settle();
  const settings = await page.locator("main").innerText();
  check("Settings lists recent sign-ins", /Recent sign-ins/i.test(settings) && /This device/.test(settings));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("Settings has no horizontal overflow at 390px", !overflow);
  check("LoginEvent stored with hashed IP", sql(`SELECT count(*) FROM "LoginEvent" e JOIN "User" u ON u.id = e."userId" WHERE u.phone = '${P1}' AND length(e."ipHash") = 64`) !== "0");

  // Health + cron
  const health = await fetch(`${BASE}/api/health`);
  check("Health endpoint answers 200 ok", health.status === 200 && (await health.json()).ok === true);
  const noAuth = await fetch(`${BASE}/api/cron/cleanup`);
  check("Cleanup cron rejects missing secret", noAuth.status === 401);
  sql(`INSERT INTO "User" (id, phone, "passwordHash", "phoneVerified", "createdAt") VALUES ('f_stale_user', '+919876500009', 'x', false, (NOW() AT TIME ZONE 'UTC') - INTERVAL '8 days')`);
  const cron = await fetch(`${BASE}/api/cron/cleanup`, { headers: { Authorization: "Bearer test_cron_secret" } });
  const cronBody = cron.ok ? await cron.json() : {};
  check("Cleanup cron deletes stale unverified accounts", cron.ok && sql(`SELECT count(*) FROM "User" WHERE id = 'f_stale_user'`) === "0", JSON.stringify(cronBody));

  // Suspension: open session is rejected, login explains why, expiry lifts it.
  sql(`UPDATE "User" SET status = 'SUSPENDED', "statusReason" = 'Test reason', "sessionVersion" = "sessionVersion" + 1, "suspendedUntil" = (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day' WHERE phone = '${P1}'`);
  await page.goto(`${BASE}/settings`);
  await page.waitForURL(/\/login/, { timeout: 180000 }).catch(() => {});
  check("Suspended member's open session is rejected", /\/login/.test(page.url()), page.url());
  await loginForm("9876500001");
  const suspended = await alertText();
  check("Login explains the suspension and reason", /suspended until/i.test(suspended) && /Test reason/.test(suspended), suspended);
  sql(`UPDATE "User" SET "suspendedUntil" = (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute' WHERE phone = '${P1}'`);
  await loginForm("9876500001");
  await page.waitForURL(/\/profile\/edit/, { timeout: 180000 }).catch(() => {});
  check("Expired suspension lifts itself on login", /\/profile\/edit/.test(page.url()) && sql(`SELECT status FROM "User" WHERE phone = '${P1}'`) === "ACTIVE");
  sql(`UPDATE "User" SET status = 'BANNED', "statusReason" = 'Fake profile' WHERE phone = '${P1}'`);
  await ctx.clearCookies();
  await loginForm("9876500001");
  const banned = await alertText();
  check("Banned account sees closed message with support pointer", /closed/i.test(banned) && /Support/.test(banned), banned);

  // Start over on the verify page deletes the unverified account.
  await ctx.clearCookies();
  await registerAndVerify("9876500002");
  await page.getByRole("button", { name: "Start again" }).click();
  await page.waitForURL(/\/register/, { timeout: 180000 });
  check("Start again removes the unverified account", sql(`SELECT count(*) FROM "User" WHERE phone = '${P2}'`) === "0");

  // Staff second step.
  await ctx.clearCookies();
  const m3 = await registerAndVerify("9876500003");
  await enterOtp(P3, m3);
  await page.waitForURL(/\/profile\/edit/, { timeout: 180000 });
  sql(`UPDATE "User" SET role = 'MODERATOR' WHERE phone = '${P3}'`);
  await ctx.clearCookies();
  const staffMark = await loginForm("9876500003");
  await page.waitForURL(/\/login\/staff/, { timeout: 180000 });
  const cookieNames = (await ctx.cookies()).map((c) => c.name);
  check("Staff password step does not create a session yet", !cookieNames.some((n) => n.endsWith("dm_session")) && cookieNames.some((n) => n.endsWith("dm_staff_pending")), cookieNames.join(","));
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(/\/login(?!\/staff)/, { timeout: 180000 }).catch(() => {});
  check("Admin portal is closed before the code is entered", !/\/admin/.test(page.url()), page.url());
  await page.goto(`${BASE}/login/staff`);
  await settle();
  await page.fill('input[name="code"]', "000000");
  await page.click('main form button[type="submit"]');
  const wrong = await alertText();
  check("Wrong staff code is refused", /Incorrect code/.test(wrong), wrong);
  const staffCode = await otpFor(P3, staffMark);
  await page.fill('input[name="code"]', staffCode);
  await page.click('main form button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 180000 });
  await settle();
  check("Correct staff code opens the admin portal", /\/admin/.test(page.url()));

  // Idle timeout.
  sql(`UPDATE "User" SET "lastActiveAt" = (NOW() AT TIME ZONE 'UTC') - INTERVAL '31 minutes' WHERE phone = '${P3}'`);
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/admin`).catch(() => page.goto(`${BASE}/admin`));
  await page.waitForURL(/\/login/, { timeout: 180000 }).catch(() => {});
  check("Staff session ends after 30 idle minutes", /\/login/.test(page.url()), page.url());
} catch (e) {
  check("Run completed", false, `${e.message.split("\n")[0]} @ ${page.url()}`);
  await page.screenshot({ path: "f-fail.png" }).catch(() => {});
} finally {
  sql(`DELETE FROM "User" WHERE phone LIKE '+91987650000%'`);
  if (!savedRef) sql(`UPDATE "User" SET "referralCode" = NULL WHERE phone = '+919000000100' AND "referralCode" = 'FTESTREF'`);
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
