// Agent A checks: admin overview, members, member detail, staff, activity, exports.
import { launch } from "./browser.mjs";
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
const browser = await launch();
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
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await login(adminCtx, "9000000000", "admin12345");
  check("Admin lands on /admin after login", new URL(page.url()).pathname === "/admin", page.url());

  const overview = await visit(page, "/admin", "admin overview");
  check("Overview shows KPI + queues + charts", /Live profiles/.test(overview) && /Waiting for the team/.test(overview) && /New signups/.test(overview) && /Revenue/.test(overview));

  const members = await visit(page, "/admin/members", "admin members");
  check("Members list shows demo members", /DM9000/.test(members));
  await visit(page, "/admin/members?q=Demo&gender=FEMALE&premium=no", "admin members filtered");

  const firstHref = await page.locator('main a[href^="/admin/members/"]').first().getAttribute("href");
  const detail = await visit(page, firstHref, "admin member detail");
  check("Detail shows admin actions", /Grant premium/.test(detail) && /Erase account/.test(detail));
  for (const tab of ["activity", "devices", "connections"]) await visit(page, `${firstHref}?tab=${tab}`, `admin member ${tab}`);

  await page.goto(`${BASE}${firstHref}`);
  await page.getByRole("button", { name: "Show phone number" }).click();
  await page.waitForSelector("text=/\\+91\\d{10}/", { timeout: 120000 });
  check("Reveal phone shows full number", true);

  await page.fill('textarea[name="notes"]', "Test note from admin-core check");
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.waitForSelector("text=Notes saved.", { timeout: 120000 });
  check("Staff notes save", true);

  await page.fill('input[name="note"]', "e2e complimentary");
  await page.fill('input[name="months"]', "1");
  await page.getByRole("button", { name: "Grant premium" }).click();
  await page.waitForSelector("text=/Premium active until/", { timeout: 120000 });
  check("Grant premium works", true);

  const staff = await visit(page, "/admin/staff", "admin staff");
  check("Staff page lists moderator", /Moderator/.test(staff));
  const activity = await visit(page, "/admin/activity", "admin activity");
  check("Activity shows the actions just taken", /Granted premium/.test(activity) && /Viewed phone number/.test(activity));

  const csv = await page.request.get(`${BASE}/api/admin/export/members`);
  check("Members CSV export", csv.status() === 200 && (await csv.text()).includes("Profile code"), String(csv.status()));
  const act = await page.request.get(`${BASE}/api/admin/export/activity`);
  check("Activity CSV export", act.status() === 200, String(act.status()));
  const json = await page.request.get(`${BASE}/api/admin/members/${firstHref.split("/").pop()}/export`);
  check("Member JSON export", json.status() === 200 && !(await json.text()).includes("passwordHash"), String(json.status()));

  // Mobile layout
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await adminCtx.storageState() });
  const m = await mobile.newPage();
  await visit(m, "/admin", "admin overview mobile");
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("No horizontal page scroll on mobile overview", !overflow);

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
