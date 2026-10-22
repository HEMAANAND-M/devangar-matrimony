// "This wasn't me": a new-device alert link signs out every device and locks the password.
import { launch } from "./browser.mjs";
import { byPhone, byPhoneOf, sql } from "./db.mjs";
const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const phone = "+919000000105";
const originalHash = sql(`SELECT "passwordHash" FROM "User" WHERE ${byPhone(`${phone}`)}`);
const browser = await launch();
async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', "9000000105");
  await page.fill('main input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  return page;
}
try {
  sql(`UPDATE "User" SET "whatsappOptIn" = true WHERE ${byPhone(`${phone}`)}`);
  sql(`DELETE FROM "LoginEvent" WHERE "userId" = (SELECT id FROM "User" WHERE ${byPhone(`${phone}`)})`);
  sql(`DELETE FROM "Notification" WHERE template='new_sign_in'`);
  const owner = await browser.newContext();
  const ownerPage = await login(owner);
  const intruder = await browser.newContext();
  const intruderPage = await login(intruder);
  await new Promise((r) => setTimeout(r, 1000));
  const params = JSON.parse(sql(`SELECT params::text FROM "Notification" WHERE template='new_sign_in' ORDER BY "createdAt" DESC LIMIT 1`) || "[]");
  const href = params[2] ?? "";
  check("Alert carries a 'This wasn't me' link", /\/security\/not-me\?t=/.test(href), href.slice(0, 60));

  const mail = await browser.newContext();
  const linkPage = await mail.newPage();
  await linkPage.goto(href.replace(/^https?:\/\/[^/]+/, BASE));
  check("Link opens the secure-your-account page", await linkPage.getByText("Sign out everywhere and lock my password").isVisible());
  await linkPage.getByRole("button", { name: "Sign out everywhere and lock my password" }).click();
  await linkPage.waitForURL(/forgot-password\?locked=1/, { timeout: 20000 });
  check("Confirmation shown on the password-reset page", await linkPage.getByText("Your account is secured.").isVisible());

  await ownerPage.goto(`${BASE}/dashboard`);
  await ownerPage.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check("Owner's old session is signed out", /\/login/.test(ownerPage.url()), ownerPage.url());
  await intruderPage.goto(`${BASE}/dashboard`);
  await intruderPage.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check("Intruder's session is signed out", /\/login/.test(intruderPage.url()), intruderPage.url());
  await intruderPage.fill('main input[name="phone"]', "9000000105");
  await intruderPage.fill('main input[name="password"]', "demo12345");
  await intruderPage.click('main button[type="submit"]');
  await intruderPage.waitForTimeout(2500);
  check("Old password no longer works", /Incorrect/.test(await intruderPage.locator('main [role="alert"]').innerText()));

  await linkPage.goto(href.replace(/^https?:\/\/[^/]+/, BASE));
  check("The link cannot be used twice", await linkPage.getByText("This link has expired or was already used.").first().isVisible());
  const forged = await mail.newPage();
  await forged.goto(`${BASE}/security/not-me?t=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged`);
  check("A forged link is refused", await forged.getByText("This link has expired or was already used.").first().isVisible());
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
} finally {
  sql(`UPDATE "User" SET "passwordHash" = '${originalHash.replace(/'/g, "''")}', "whatsappOptIn" = false WHERE ${byPhone(`${phone}`)}`);
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
