// Turnstile checks. Run against a server using Cloudflare's test keys:
//   pass mode: TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA  -> node turnstile.mjs pass
//   fail mode: TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA  -> node turnstile.mjs fail
import { launch } from "./browser.mjs";
const BASE = "http://localhost:3000";
const mode = process.argv[2] ?? "pass";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const browser = await launch();
const page = await (await browser.newContext()).newPage();
const cspErrors = [];
page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && cspErrors.push(m.text().slice(0, 200)));
try {
  await page.goto(`${BASE}/login`);
  const frame = page.locator('input[name="cf-turnstile-response"]');
  check("Turnstile widget renders on login", await frame.first().waitFor({ state: "attached", timeout: 20000 }).then(() => true, () => false));
  // The test site key solves itself; wait for the token field to be filled.
  const token = await page.waitForFunction(() => document.querySelector('input[name="cf-turnstile-response"]')?.value, null, { timeout: 20000 }).then(() => true, () => false);
  check("Widget produces a token", token);
  check("No CSP violations", cspErrors.length === 0, cspErrors.join(" | "));
  await page.fill('main input[name="phone"]', "9000000105");
  await page.fill('main input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  if (mode === "pass") {
    check("Login succeeds with a valid token", await page.waitForURL(/dashboard/, { timeout: 20000 }).then(() => true, () => false), page.url());
  } else {
    const alert = page.locator('main [role="alert"]');
    await alert.waitFor({ timeout: 20000 });
    check("Login refused when the bot check fails", /security check/.test(await alert.innerText()), await alert.innerText());
  }
  for (const p of ["/register", "/forgot-password", "/support"]) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}${p}`);
    check(`Widget on ${p}`, await pg.locator('input[name="cf-turnstile-response"]').first().waitFor({ state: 'attached', timeout: 20000 }).then(() => true, () => false));
    await ctx.close();
  }
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
