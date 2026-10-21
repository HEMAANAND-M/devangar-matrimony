// Agent D: profile edit fields, horoscope upload, profile page, search/saved searches, visitors,
// interests, shortlist, cron and phone-width layout.
import { launch } from "./browser.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.argv[2] ?? "http://localhost:3104";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "d-e2e-"));
const pdf = path.join(tmp, "horoscope.pdf");
fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const png = path.join(tmp, "horoscope.png");
fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const fake = path.join(tmp, "fake.pdf");
fs.writeFileSync(fake, "<html><script>alert(1)</script></html>");

const browser = await launch();
const _newContext = browser.newContext.bind(browser);
browser.newContext = async (o) => { const c = await _newContext(o); c.setDefaultTimeout(180000); return c; };
const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});

async function login(ctx, phone) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/(dashboard|profile)/, { timeout: 60000 });
  await settle(page);
  return page;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await login(ctx, "9000000103");
  check("Dashboard loads with visitors card", /visitors/i.test(await page.locator("main").innerText()));

  // ---- Profile edit
  await page.goto(`${BASE}/profile/edit`);
  await settle(page);
  check("Section nav present", await page.locator('nav[aria-label="Profile sections"] a[href="#family"]').count() === 1);
  await page.selectOption('select[name="lagnam"]', "Simmam");
  await page.selectOption("#gothram-choice", "Kashyapa");
  await page.fill('input[name="fatherName"]', "R. Sundaram");
  await page.fill('input[name="motherName"]', "S. Lakshmi");
  await page.selectOption('select[name="familyType"]', "Joint family");
  await page.selectOption('select[name="familyStatus"]', "Upper middle class");
  await page.fill('input[name="nativePlace"]', "Somanur");
  await page.selectOption('select[name="diet"]', "Vegetarian");
  await page.selectOption('select[name="complexion"]', "Wheatish");
  for (const l of ["Tamil", "Telugu"]) {
    const box = page.locator(`input[name="languages"][value="${l}"]`);
    if (!(await box.isChecked())) await box.check();
  }
  await page.locator("details", { hasText: "Preferred stars" }).locator("summary").click();
  for (const s of ["Rohini", "Hastham"]) {
    const box = page.locator(`input[name="prefStars"][value="${s}"]`);
    if (!(await box.isChecked())) await box.check();
  }
  await page.locator("details", { hasText: "Preferred cities" }).locator("summary").click();
  await page.evaluate(() => document.querySelector('input[name="prefCitiesOther"]')?.closest("details")?.setAttribute("open", ""));
  await page.fill('input[name="prefCitiesOther"]', "Pollachi");
  await page.selectOption('select[name="prefDosham"]', "NO");
  await page.click('form button[type="submit"]:has-text("Save changes")');
  const status = page.locator('main [role="status"]:not(:empty), main [role="alert"]:not(:empty)').first();
  await status.waitFor({ timeout: 30000 });
  const statusText = await status.innerText();
  check("Profile save with new fields succeeds", /saved/i.test(statusText), statusText);

  await page.goto(`${BASE}/profile/edit`);
  await settle(page);
  check("Saved values persist (father name)", (await page.inputValue('input[name="fatherName"]')) === "R. Sundaram");
  check("Saved values persist (gothram choice)", (await page.inputValue('input[type="hidden"][name="gothram"]')) === "Kashyapa");
  check("Saved values persist (pref star)", await page.locator('input[name="prefStars"][value="Rohini"]').isChecked());
  check("Saved values persist (other city)", (await page.inputValue('input[name="prefCitiesOther"]')).includes("Pollachi"));

  // "Other" gothram option reveals a text box.
  await page.selectOption("#gothram-choice", "__other");
  check("Other… reveals a text box", await page.locator('input[aria-label="Gothram (other)"]').isVisible());
  await page.selectOption("#gothram-choice", "Kashyapa");

  // ---- Horoscope upload
  const uploadForm = page.locator("#horoscope-file form").last();
  await uploadForm.locator('input[type="file"]').setInputFiles(fake);
  await uploadForm.locator('button[type="submit"]').click();
  await page.locator('#horoscope-file [role="alert"]').waitFor({ timeout: 30000 });
  check("Fake PDF rejected", /PDF, JPEG/.test(await page.locator('#horoscope-file [role="alert"]').innerText()));

  await uploadForm.locator('input[type="file"]').setInputFiles(png);
  await uploadForm.locator('button[type="submit"]').click();
  await page.locator('#horoscope-file [role="status"]').waitFor({ timeout: 30000 });
  check("PNG horoscope uploaded", /uploaded/i.test(await page.locator('#horoscope-file [role="status"]').innerText()));
  await page.reload();
  await settle(page);
  const viewHref = await page.locator('#horoscope-file a:has-text("View")').getAttribute("href");
  const own = await page.request.get(`${BASE}${viewHref}`);
  check("Owner can fetch horoscope as WebP", own.status() === 200 && own.headers()["content-type"] === "image/webp", `${own.status()} ${own.headers()["content-type"]}`);
  check("Horoscope response is private no-cache", own.headers()["cache-control"] === "private, no-cache");

  await page.locator("#horoscope-file form").last().locator('input[type="file"]').setInputFiles(pdf);
  await page.locator("#horoscope-file form").last().locator('button[type="submit"]').click();
  await page.locator('#horoscope-file [role="status"]').waitFor({ timeout: 30000 });
  const own2 = await page.request.get(`${BASE}${viewHref}`);
  check("PDF replaces image", own2.headers()["content-type"] === "application/pdf" && /sandbox/.test(own2.headers()["content-security-policy"] ?? ""));
  check("Rasi chart rendered", (await page.locator("#horoscope-file svg[role=img]").count()) === 1);

  // ---- Another member's profile (female DM90001, horoscope private by default)
  await page.goto(`${BASE}/profiles/DM90001`);
  await settle(page);
  const body = await page.locator("main").innerText();
  check("Profile page shows match section", body.includes("Why you may match") && /% match/.test(body));
  check("Mobile verified badge", body.includes("Mobile verified"));
  check("Report form has category select", (await page.locator('select[name="category"]').count()) === 1);
  check("Lifestyle card present", body.includes("Lifestyle"));

  // Another female member must not fetch DM90004's horoscope (not connected, accepted-only default).
  const ctxF = await browser.newContext();
  const pf = await login(ctxF, "9000000101");
  const denied = await pf.request.get(`${BASE}${viewHref}`);
  check("Unconnected member cannot fetch accepted-only horoscope", denied.status() === 404, String(denied.status()));
  await pf.goto(`${BASE}/profiles/DM90004`);
  await settle(pf);
  const fbody = await pf.locator("main").innerText();
  check("Their view shows new family facts", fbody.includes("R. Sundaram") && fbody.includes("Somanur"));
  check("Their view explains horoscope is shared on acceptance", fbody.includes("shared once this member accepts"));
  // Same-gender member never sees it either.
  const ctxM = await browser.newContext();
  const pm = await login(ctxM, "9000000105");
  check("Same-gender member cannot fetch horoscope", (await pm.request.get(`${BASE}${viewHref}`)).status() === 404);

  // Report with category
  await page.locator("summary", { hasText: "Report this profile" }).click();
  await page.selectOption('select[name="category"]', "HARASSMENT");
  await page.fill('textarea[name="reason"]', "Test report from the automated check — please ignore.");
  await page.click('button:has-text("Submit report")');
  check("Report with category submitted", await page.getByText("Thank you. Our team will review this profile.").waitFor({ timeout: 20000 }).then(() => true, () => false));

  // ---- Search
  await page.goto(`${BASE}/search?sort=match&gothram=include`);
  await settle(page);
  check("Search by match sort shows match badges", (await page.locator("main a[href^='/profiles/']", { hasText: "% match" }).count()) > 0);
  await page.goto(`${BASE}/search?star=Rohini&star=Ashwini&gothram=include`);
  await settle(page);
  const chipText = await page.locator("main ul").first().innerText();
  check("Multi-star chips shown", chipText.includes("Star: Rohini") && chipText.includes("Star: Ashwini"), chipText.replace(/\s+/g, " "));
  const cards = await page.locator("main a[href^='/profiles/']").allInnerTexts();
  check("Multi-star results only include those stars", cards.length > 0 && cards.every((t) => /Rohini|Ashwini/.test(t)), `${cards.length} cards`);
  await page.goto(`${BASE}/search?gothram=exclude`);
  await settle(page);
  const gothCards = await page.locator("main a[href^='/profiles/']").count();
  check("Gothram exclusion chip", (await page.locator("main").innerText()).includes("Not Kashyapa gothram"), `${gothCards} cards`);
  await page.goto(`${BASE}/search?verified=1&active=1&withPhoto=1`);
  await settle(page);
  check("Verified/active/photo filters render", (await page.locator("main").innerText()).includes("ID verified"));

  await page.goto(`${BASE}/search?star=Rohini&gothram=include`);
  await settle(page);
  await page.locator("summary", { hasText: "Save this search" }).click();
  await page.fill('input[name="name"]', "Rohini brides");
  const t0 = Date.now();
  page.on("requestfinished", async (r) => { if (r.method() === "POST") console.log("DEBUG POST", r.url(), Date.now() - t0, "ms"); });
  page.on("pageerror", (e) => console.log("DEBUG PAGEERROR", e.message.slice(0, 300)));
  page.on("console", (m) => m.type() === "error" && console.log("DEBUG CONSOLE", m.text().slice(0, 300)));
  await page.locator('details button:has-text("Save")').click();
  await page.getByText("Search saved.").waitFor({ timeout: 20000 }).catch(async (e) => { console.log("DEBUG alerts:", await page.locator("[role=alert], [role=status]").allInnerTexts()); await page.screenshot({ path: "d-fail.png", fullPage: true }); throw e; });
  await page.reload();
  await settle(page);
  check("Saved search listed", (await page.locator("main").innerText()).includes("Rohini brides"));
  await page.locator("main a", { hasText: "Rohini brides" }).click();
  await page.waitForURL(/star=Rohini/);
  check("Saved search re-runs with its params", /star=Rohini/.test(page.url()));

  // ---- Visitors (free member): locked
  await page.goto(`${BASE}/visitors`);
  await settle(page);
  const vtext = await page.locator("main").innerText();
  check("Visitors page loads for free member", vtext.includes("Viewed you"));
  check("Free member sees no visitor names", !/DM9000[1-3]/.test(vtext));
  // DM90001 just viewed? pf (DM90002) viewed DM90004 above, so there is at least one visitor.
  check("Free member sees upgrade prompt", vtext.includes("See exactly who is interested"), vtext.slice(0, 200).replace(/\s+/g, " "));

  // Premium male DM90005 sees visitors list (after DM90002 views him).
  await pf.goto(`${BASE}/profiles/DM90005`);
  await settle(pf);
  const ctxP = await browser.newContext();
  const pp = await login(ctxP, "9000000104");
  await pp.goto(`${BASE}/visitors`);
  await settle(pp);
  check("Premium member sees visitor cards", (await pp.locator("main a[href='/profiles/DM90002']").count()) > 0);

  // ---- Interests & shortlist empty states
  await page.goto(`${BASE}/interests?tab=accepted`);
  await settle(page);
  check("Interests connected tab renders", (await page.locator("main").innerText()).includes("Phone number requests"));
  await page.goto(`${BASE}/shortlist`);
  await settle(page);
  check("Shortlist renders", (await page.locator("main h1").innerText()).includes("Shortlist"));

  // ---- Cron
  const unauth = await page.request.get(`${BASE}/api/cron/saved-searches`);
  check("Cron rejects without secret", unauth.status() === 401);
  const cron = await page.request.get(`${BASE}/api/cron/saved-searches`, { headers: { authorization: "Bearer test_cron_secret" } });
  check("Cron runs with secret", cron.status() === 200, await cron.text());

  // ---- Phone width
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
  const pg = await phone.newPage();
  for (const url of ["/dashboard", "/profile/edit", "/profiles/DM90001", "/search", "/visitors", "/interests", "/shortlist", "/photos"]) {
    await pg.goto(`${BASE}${url}`);
    await settle(pg);
    const w = await pg.evaluate(() => document.documentElement.scrollWidth);
    check(`No horizontal overflow at 390px: ${url}`, w <= 390, `scrollWidth=${w}`);
  }
  await pg.goto(`${BASE}/profile/edit`);
  await settle(pg);
  await pg.screenshot({ path: path.join(tmp, "edit-390.png"), fullPage: false });
  console.log("screens:", tmp);
} catch (e) {
  check("Run completed", false, e.message.split("\n").slice(0, 5).join(" | "));
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
