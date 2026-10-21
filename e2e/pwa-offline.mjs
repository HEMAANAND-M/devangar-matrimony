// Real offline test: primes the service worker, waits for the server to stop, then navigates.
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ serviceWorkers: "allow" });
const page = await ctx.newPage();
await page.goto(`${BASE}/`);
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload();
console.log("READY controlled:", await page.evaluate(() => !!navigator.serviceWorker.controller));
for (let i = 0; i < 120; i++) {
  const up = await fetch(`${BASE}/api/health`).then(() => true, () => false);
  if (!up) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const r = await page.goto(`${BASE}/dashboard`, { timeout: 15000 }).catch((e) => e);
console.log("offline page shown:", await page.getByText("You are offline").isVisible().catch(() => false));
console.log("served by SW:", r && typeof r.fromServiceWorker === "function" ? r.fromServiceWorker() : String(r).slice(0, 80));
await browser.close();
