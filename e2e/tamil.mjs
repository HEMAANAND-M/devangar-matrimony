// Tamil checks: language switch (signed out and signed in), saved preference, html lang, layout.
import { launch } from "./browser.mjs";
import { sql } from "./db.mjs";
const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const browser = await launch();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
try {
  // Signed out: switch from the footer.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  check("Default language is English", (await page.evaluate(() => document.documentElement.lang)) === "en");
  await page.locator("footer button", { hasText: "தமிழ்" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "ta", null, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  check("Switching to Tamil reloads the page in Tamil", true);
  check("Cookie dm_lang=ta set", (await ctx.cookies()).some((c) => c.name === "dm_lang" && c.value === "ta"));
  for (const p of ["/", "/login", "/register", "/faq", "/stories", "/events", "/support"]) {
    await page.goto(`${BASE}${p}`);
    const o = await overflow(page);
    check(`No sideways scroll in Tamil at 390px: ${p}`, o <= 0, o > 0 ? `${o}px` : "");
  }

  // Signed in: the choice is saved on the account and comes back after cookies are cleared.
  const phone = "+919000000105";
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', "9000000105");
  await page.fill('main input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/dashboard/);
  await page.locator("footer button", { hasText: "English" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  await page.locator("footer button", { hasText: "தமிழ்" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "ta", null, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  check("Signed-in choice saved on the account", sql(`SELECT locale FROM "User" WHERE phone='${phone}'`) === "ta");
  for (const p of ["/dashboard", "/search", "/profiles/DM90002", "/interests", "/messages", "/settings", "/visitors", "/upgrade"]) {
    const res = await page.goto(`${BASE}${p}`);
    const o = await overflow(page);
    check(`Tamil member page renders: ${p}`, res.status() === 200 && o <= 0, `${res.status()}${o > 0 ? `, overflow ${o}px` : ""}`);
  }
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/login`);
  await p2.fill('main input[name="phone"]', "9000000105");
  await p2.fill('main input[name="password"]', "demo12345");
  await p2.click('main button[type="submit"]');
  await p2.waitForURL(/dashboard/);
  check("Saved Tamil preference applies on a new device", (await p2.evaluate(() => document.documentElement.lang)) === "ta");
  sql(`UPDATE "User" SET locale='en' WHERE phone='${phone}'`);
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
  sql(`UPDATE "User" SET locale='en' WHERE phone='+919000000105'`);
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
