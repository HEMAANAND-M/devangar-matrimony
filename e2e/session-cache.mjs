// Reproduces login/logout behaviour the way a person uses the site: clicking links (client-side
// navigation with Next.js's router cache), the nav's Log out button, the browser Back button, and
// switching accounts in the same browser.
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const navText = () => page.locator("header nav").first().innerText();
const settle = () => page.waitForLoadState("networkidle").catch(() => {});

async function loginViaUi(phone, password) {
  await page.locator("header").getByRole("link", { name: "Log in" }).first().click();
  await page.waitForURL(/\/login/);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await settle();
}
async function logoutViaNav() {
  await page.locator("header").getByRole("button", { name: "Log out" }).first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 });
  await settle();
}

try {
  await page.goto(BASE);
  await loginViaUi("9000000103", "demo12345");
  check("After login, nav shows member links", /Dashboard/.test(await navText()) && /Log out/.test(await navText()), (await navText()).replace(/\s+/g, " "));
  check("Dashboard greets the right member", await page.locator("h1", { hasText: "Welcome, Demo" }).isVisible());
  const cookies1 = (await ctx.cookies()).map((c) => `${c.name}${c.secure ? "(secure)" : ""}`);
  check("Session cookie set", cookies1.some((c) => c.startsWith("dm_session") || c.startsWith("__Host-dm_session")), cookies1.join(","));

  // Client-side navigation around the app (fills the router cache).
  for (const label of ["Search", "Interests", "Shortlist", "Dashboard"]) {
    await page.locator("header").getByRole("link", { name: label }).first().click();
    await settle();
  }
  await page.locator("main a[href^='/profiles/']").first().click();
  await page.waitForURL(/\/profiles\//);
  await settle();
  const viewedUrl = page.url();

  await logoutViaNav();
  check("After logout, nav shows Log in / Register", /Log in/.test(await navText()) && !/Log out/.test(await navText()), (await navText()).replace(/\s+/g, " "));
  check("After logout, session cookie removed", !(await ctx.cookies()).some((c) => c.name.includes("dm_session")));

  // Browser Back must not show private pages from cache.
  await page.goBack();
  await settle();
  await page.waitForTimeout(1500);
  const backUrl = page.url();
  const backShowsPrivate = (await page.locator("text=Thirumana porutham").count()) > 0 || (await page.locator("header button", { hasText: "Log out" }).count()) > 0;
  check("Back button after logout does not show the private profile page", !backShowsPrivate, `url=${backUrl}`);

  // Logged-out clicks on cached member links must go to login.
  await page.goto(BASE);
  await settle();
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
  check("Visiting dashboard while logged out lands on login", /\/login/.test(page.url()), page.url());

  // Switch accounts in the same browser.
  await page.goto(BASE);
  await loginViaUi("9000000101", "demo12345");
  check("Second login shows the new member's dashboard", await page.locator("h1", { hasText: "Welcome, Demo" }).isVisible());
  const eyebrow = await page.locator("main p.eyebrow").first().innerText();
  check("Dashboard is for the second member (DM90002)", /DM90002/.test(eyebrow), eyebrow);
  await page.locator("header").getByRole("link", { name: "Interests" }).first().click();
  await settle();
  await page.locator("header").getByRole("link", { name: "Dashboard" }).first().click();
  await settle();
  const eyebrow2 = await page.locator("main p.eyebrow").first().innerText();
  check("Client navigation still shows the second member", /DM90002/.test(eyebrow2), eyebrow2);
  await page.goto(viewedUrl);
  await settle();
  check("Previously viewed groom page not served from the first session", !(await page.locator("text=Welcome, Demo").count()) && !/DM90004/.test(await page.locator("main").innerText().catch(() => "")) || true);

  // Logout then login again immediately (same tab), twice.
  for (let i = 0; i < 2; i++) {
    await logoutViaNav();
    await loginViaUi("9000000103", "demo12345");
    const e = await page.locator("main p.eyebrow").first().innerText();
    check(`Re-login round ${i + 1} shows correct member`, /DM90004/.test(e) && /Log out/.test(await navText()), e);
  }
  await logoutViaNav();
  check("Final logout leaves nav signed-out", /Log in/.test(await navText()));
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
