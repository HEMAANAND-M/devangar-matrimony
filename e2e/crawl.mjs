// Crawls every same-site link reachable as each role and reports non-2xx pages and browser errors.
// Usage: node crawl.mjs <server-log> [maxPagesPerRole]
import fs from "node:fs";
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const LOG = process.argv[2];
const MAX = Number(process.argv[3] ?? 120);
const readLog = () => { const b = fs.readFileSync(LOG); return b[0] === 0xff && b[1] === 0xfe ? b.toString("utf16le") : b.toString("utf8"); };
// Never follow links that change state or end the session.
const SKIP = /\/api\/|logout|\/admin\/members\/[^/]+\/export|\.(csv|json|pdf)$|[?&](download|page)=/;

async function signIn(page, phone, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', phone);
  await page.fill('main input[name="password"]', password);
  const mark = readLog().length;
  await page.click('main button[type="submit"]');
  await page.waitForURL((u) => !/\/login$/.test(u.pathname), { timeout: 30000 });
  if (/login\/staff/.test(page.url())) {
    let code;
    for (let i = 0; i < 40 && !code; i++) {
      code = [...readLog().slice(mark).matchAll(new RegExp(`\\[OTP\\] \\+91${phone}: (\\d{6})`, "g"))].at(-1)?.[1];
      if (!code) await page.waitForTimeout(500);
    }
    await page.fill('input[name="code"]', code);
    await page.click("main form button[type=submit]");
    await page.waitForURL(/\/admin/);
  }
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const roles = [
  ["visitor", null, null, "/"],
  ["member", "9000000104", "demo12345", "/dashboard"],
  ["moderator", "9000000001", "moderator123", "/admin"],
  ["admin", "9000000000", "admin12345", "/admin"],
];
let problems = 0;
for (const [role, phone, password, start] of roles) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource: the server responded with a status of 40[134]/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 160)}`));
  if (phone) await signIn(page, phone, password);
  const queue = [start];
  const seen = new Set();
  const report = [];
  while (queue.length && seen.size < MAX) {
    const path = queue.shift();
    const key = path.replace(/\?.*$/, (q) => (q.length > 40 ? "?…" : q));
    if (seen.has(key)) continue;
    seen.add(key);
    errors.length = 0;
    let status = 0;
    try {
      const res = await page.goto(`${BASE}${path}`, { timeout: 30000 });
      status = res?.status() ?? 0;
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    } catch (e) {
      report.push(`ERR  ${path}  ${e.message.split("\n")[0]}`);
      continue;
    }
    if (status >= 400 && !(status === 404 && /no-such/.test(path))) report.push(`${status}  ${path}`);
    for (const err of errors) report.push(`JS   ${path}  ${err}`);
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const href of links) {
      if (!href || !href.startsWith("/") || href.startsWith("//") || SKIP.test(href)) continue;
      const clean = href.split("#")[0];
      if (!seen.has(clean) && !queue.includes(clean)) queue.push(clean);
    }
  }
  console.log(`\n== ${role}: ${seen.size} pages crawled, ${report.length} problems`);
  for (const r of report) console.log("   " + r);
  problems += report.length;
  await page.context().close();
}
await browser.close();
console.log(`\nTotal problems: ${problems}`);
