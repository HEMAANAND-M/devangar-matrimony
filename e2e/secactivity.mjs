// Security activity in Settings: new-device sign-in and "sign out everywhere" are listed.
import { launch } from "./browser.mjs";
import { byPhone, byPhoneOf, sql } from "./db.mjs";
const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const phone = "+919000000102";
const browser = await launch();
async function login() {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', "9000000102");
  await page.fill('main input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  return page;
}
try {
  sql(`DELETE FROM "LoginEvent" WHERE "userId" = (SELECT id FROM "User" WHERE ${byPhone(`${phone}`)})`);
  sql(`DELETE FROM "SecurityEvent" WHERE "userId" = (SELECT id FROM "User" WHERE ${byPhone(`${phone}`)})`);
  await login();
  const second = await login();
  await second.goto(`${BASE}/settings`);
  const section = second.locator("section", { hasText: "Security activity" });
  check("Security activity lists the new-device sign-in", await section.getByText("Signed in from a new device").isVisible().catch(() => false));
  await second.locator("button", { hasText: /Log out of all devices|Sign out of all devices|all devices/i }).first().click();
  await second.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
  const kinds = sql(`SELECT string_agg(kind, ',' ORDER BY "createdAt") FROM "SecurityEvent" WHERE "userId" = (SELECT id FROM "User" WHERE ${byPhone(`${phone}`)})`);
  check("Signing out everywhere is recorded", kinds.includes("signed_out_everywhere"), kinds);
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
