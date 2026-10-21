// PWA: service worker registers, offline page works, and no personal page is ever cached.
import { launch } from "./browser.mjs";
const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const browser = await launch();
const ctx = await browser.newContext({ serviceWorkers: "allow" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && errors.push(m.text().slice(0, 160)));
try {
  await page.goto(`${BASE}/login`);
  const active = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state ?? "none");
  check("Service worker registers and activates", active === "activated" || active === "activating", active);
  await page.fill('main input[name="phone"]', "9000000104");
  await page.fill('main input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/dashboard/);
  await page.goto(`${BASE}/profiles/DM90002`);
  await page.waitForLoadState("networkidle");
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
    return out;
  });
  const personal = cached.filter((p) => !p.startsWith("/_next/static/") && p !== "/offline.html" && p !== "/icon-192.png");
  check("Only static files are cached", personal.length === 0, personal.slice(0, 5).join(", ") || `${cached.length} static entries`);
  // Offline behaviour is covered by pwa-offline.mjs (browser offline mode does not apply to service workers).
  check("No CSP violations", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
