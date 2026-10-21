// Agent A checks: admin overview, members, member detail, staff, activity, exports.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const LOG = process.argv[3];
const lastOtp = (phone) => [...readFileSync(LOG, "utf8").matchAll(new RegExp(`\\[OTP\\] \\+91${phone}: (\\d{6})`, "g"))].pop()?.[1];

const BASE = process.argv[2] ?? "http://localhost:3101";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctxOpts = { viewport: { width: 1440, height: 900 } };

async function login(ctx, phone, password) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login") || u.pathname === "/login/staff", { timeout: 240000 });
  if (new URL(page.url()).pathname === "/login/staff") {
    await page.waitForTimeout(500);
    await page.fill('input[name="code"]', lastOtp(phone));
    await page.click('main button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 240000 });
  }
  return page;
}

const consoleErrors = [];
async function visit(page, path, name) {
  if (!page.__hooked) { page.__hooked = true; page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${new URL(page.url()).pathname}: ${m.text().slice(0, 300)}`)); page.on("pageerror", (e) => consoleErrors.push(`${new URL(page.url()).pathname}: pageerror ${e.message.slice(0, 300)}`)); }
  const res = await page.goto(`${BASE}${path}`, { timeout: 120000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await page.locator("body").innerText();
  const ok = res.status() === 200 && !/Application error|Unhandled Runtime Error|Something went wrong/i.test(text);
  check(`${name} loads`, ok, `${res.status()} ${page.url()}`);
  await page.screenshot({ path: `${SHOTS}${name.replace(/\W+/g, "-")}.png`, fullPage: true });
  return text;
}

try {
  const firstHref = "/admin/members/cmvgfzbs60003q244ua0jy0s2";
  // Moderator
  const modCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mp = await login(modCtx, "9000000001", "moderator123");
  check("Moderator lands on /admin", new URL(mp.url()).pathname === "/admin", mp.url());
  const modOverview = await visit(mp, "/admin", "moderator overview");
  check("Moderator sees no revenue", !/Revenue/.test(modOverview));
  const modDetail = await visit(mp, firstHref, "moderator member detail");
  check("Moderator has no admin actions", !/Grant premium|Erase account|Show phone number/.test(modDetail));
  const modCsv = await mp.request.get(`${BASE}/api/admin/export/members`);
  check("Moderator blocked from CSV export", modCsv.status() === 403, String(modCsv.status()));
  await mp.goto(`${BASE}/admin/staff`);
  check("Moderator redirected away from staff page", new URL(mp.url()).pathname !== "/admin/staff", mp.url());

  // Member cannot reach admin
  const memCtx = await browser.newContext();
  const mem = await login(memCtx, "9000000103", "demo12345");
  await mem.goto(`${BASE}/admin/members`);
  check("Member cannot open admin members", !new URL(mem.url()).pathname.startsWith("/admin"), mem.url());
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
console.log("\nConsole errors:\n" + ([...new Set(consoleErrors)].join("\n") || "none"));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
