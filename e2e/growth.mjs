// Advertisements carousel, bulk campaigns, renewal reminders and signed (CDN-cacheable) photo URLs.
import { createRequire } from "node:module";
import { launch } from "./browser.mjs";
import { sql } from "./db.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const require = createRequire(new URL("../package.json", import.meta.url));
const sharp = require("sharp");
const CRON = { Authorization: "Bearer test_cron_secret" };
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const browser = await launch();

async function signIn(phone, password) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', phone);
  await page.fill('main input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  return page;
}

try {
  sql(`DELETE FROM "Advertisement"; DELETE FROM "Campaign"; DELETE FROM "Notification"`);
  const admin = await signIn("9000000000", "admin12345");

  // ── Advertisements ────────────────────────────────────────────
  const banner = await sharp({ create: { width: 2000, height: 900, channels: 3, background: { r: 120, g: 30, b: 50 } } }).jpeg().toBuffer();
  await admin.goto(`${BASE}/admin/ads`);
  await admin.fill('input[name="advertiser"]', "Lakshmi Studios (test)");
  await admin.fill('input[name="title"]', "Candid wedding photography");
  await admin.fill('input[name="tagline"]', "10% off for members");
  await admin.fill('input[name="href"]', "https://example.com/studio");
  await admin.setInputFiles('input[name="image"]', { name: "banner.jpg", mimeType: "image/jpeg", buffer: banner });
  await admin.click('button:has-text("Add advertisement")');
  await admin.waitForLoadState("networkidle");
  await admin.waitForTimeout(1500);
  const adId = sql(`SELECT id FROM "Advertisement" WHERE advertiser = 'Lakshmi Studios (test)'`);
  check("Admin can add an advertisement", !!adId);
  const meta = await sharp(Buffer.from(await (await fetch(`${BASE}/api/ads/${adId}`)).arrayBuffer())).metadata();
  check("Banner re-encoded to 1600×600 WebP", meta.format === "webp" && meta.width === 1600 && meta.height === 600, `${meta.format} ${meta.width}x${meta.height}`);

  const visitor = await (await browser.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  await visitor.goto(BASE);
  await visitor.waitForLoadState("networkidle");
  const carousel = visitor.locator("section", { hasText: "Sponsored" });
  check("Home page shows the sponsored carousel", (await carousel.count()) > 0 && (await visitor.locator(`img[src*="/api/ads/${adId}"]`).count()) > 0);
  const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("Carousel fits a phone screen", overflow <= 0, `${overflow}px`);
  const img = await fetch(`${BASE}/api/ads/${adId}`);
  check("Ad image is publicly cacheable", img.status === 200 && /public/.test(img.headers.get("cache-control") ?? ""), img.headers.get("cache-control"));
  const click = await fetch(`${BASE}/api/ads/${adId}/click`, { redirect: "manual" });
  check("Ad click redirects to the advertiser", click.status === 302 && click.headers.get("location") === "https://example.com/studio", `${click.status} ${click.headers.get("location")}`);
  await fetch(`${BASE}/api/ads/${adId}/click`, { redirect: "manual" });
  check("Repeated clicks within a minute count once", sql(`SELECT clicks FROM "Advertisement" WHERE id='${adId}'`) === "1");
  check("Impressions are counted", Number(sql(`SELECT impressions FROM "Advertisement" WHERE id='${adId}'`)) >= 1);
  sql(`UPDATE "Advertisement" SET active = false WHERE id='${adId}'`);
  await visitor.goto(BASE);
  check("Paused ad disappears from the home page", (await visitor.locator(`img[src*="/api/ads/${adId}"]`).count()) === 0);
  check("Paused ad image is not public", (await fetch(`${BASE}/api/ads/${adId}`)).status === 404);

  // ── Campaigns ─────────────────────────────────────────────────
  sql(`UPDATE "User" SET "whatsappOptIn" = true WHERE phone IN ('+919000000100','+919000000101','+919000000102')`);
  await admin.goto(`${BASE}/admin/campaigns`);
  await admin.fill('input[name="name"]', "Diwali greetings (test)");
  await admin.selectOption('select[name="template"]', "announcement");
  await admin.waitForTimeout(300);
  await admin.fill('[name="p_message"]', "Happy Diwali from Devangar Matrimony!");
  await admin.fill('input[name="p_link"]', "https://example.com");
  await admin.locator("form button[type=submit]").last().click();
  await admin.waitForURL(/\/admin\/campaigns\/c/, { timeout: 20000 });
  const reach = await admin.locator("div", { hasText: /^Would reach/ }).first().innerText().catch(() => "");
  check("Draft shows how many opted-in members it would reach", /Would reach\s*\n?\s*[1-9]/i.test(reach), reach.replace(/\s+/g, " ").slice(0, 60));
  await admin.getByRole("button", { name: "Start sending" }).click();
  await admin.waitForTimeout(2500);
  const campaignId = sql(`SELECT id FROM "Campaign" WHERE name='Diwali greetings (test)'`);
  const queued = Number(sql(`SELECT count(*) FROM "Notification" WHERE "campaignId"='${campaignId}'`));
  check("Starting a campaign queues one message per opted-in member", queued >= 3, `${queued} messages`);
  const personalised = sql(`SELECT count(*) FROM "Notification" n JOIN "Profile" p ON p."userId" = n."userId" WHERE n."campaignId"='${campaignId}' AND n.params->>0 = split_part(p.name, ' ', 1)`);
  check("Campaign messages are personalised with each member's first name", Number(personalised) === queued, `${personalised} of ${queued}`);
  check("Campaign cron rejects calls without the secret", (await fetch(`${BASE}/api/cron/campaigns`)).status === 401);
  const run = await fetch(`${BASE}/api/cron/campaigns`, { headers: CRON });
  check("Campaign cron finishes the campaign", run.ok && sql(`SELECT status FROM "Campaign" WHERE id='${campaignId}'`) === "SENT", sql(`SELECT status FROM "Campaign" WHERE id='${campaignId}'`));

  // ── Renewal reminders ─────────────────────────────────────────
  sql(`UPDATE "Profile" SET "premiumUntil" = (now() AT TIME ZONE 'UTC') + interval '7 days' WHERE code='DM90005'`);
  sql(`UPDATE "User" SET "whatsappOptIn" = true WHERE phone='+919000000104'`);
  check("Renewal cron rejects calls without the secret", (await fetch(`${BASE}/api/cron/renewal-reminders`)).status === 401);
  await fetch(`${BASE}/api/cron/renewal-reminders`, { headers: CRON });
  const reminder = sql(`SELECT params::text FROM "Notification" n JOIN "User" u ON u.id = n."userId" WHERE u.phone='+919000000104' AND template='premium_expiring'`);
  check("Member is reminded 7 days before premium ends", /renew=1/.test(reminder), reminder.slice(0, 90));
  await fetch(`${BASE}/api/cron/renewal-reminders`, { headers: CRON });
  check("Reminder is not sent twice", sql(`SELECT count(*) FROM "Notification" n JOIN "User" u ON u.id = n."userId" WHERE u.phone='+919000000104' AND template='premium_expiring'`) === "1");
  const member = await signIn("9000000104", "demo12345");
  await member.goto(`${BASE}/upgrade?plan=gold-6&renew=1`);
  check("Renewal link opens the Premium page at the plan", await member.locator("#plan-gold-6").isVisible());

  // ── Signed photo URLs ─────────────────────────────────────────
  const photo = sql(`SELECT ph.id FROM "Photo" ph JOIN "Profile" p ON p.id = ph."profileId" WHERE ph.approved AND p.status='APPROVED' AND p.gender='FEMALE' AND p.code LIKE 'DM9000%' AND p."photoVisibility"='ALL_MEMBERS' LIMIT 1`);
  if (photo) {
    const code = sql(`SELECT p.code FROM "Photo" ph JOIN "Profile" p ON p.id = ph."profileId" WHERE ph.id='${photo}'`);
    await member.goto(`${BASE}/profiles/${code}`);
    const src = await member.locator(`img[src*="/api/photos/${photo}"]`).first().getAttribute("src");
    check("Profile page uses a signed photo URL", /sig=/.test(src ?? ""), src ?? "none");
    const signed = await fetch(`${BASE}${src}`);
    check("Signed photo loads without a login and is CDN-cacheable", signed.status === 200 && /public/.test(signed.headers.get("cache-control") ?? "") && !/cookie/i.test(signed.headers.get("vary") ?? ""), `${signed.status} ${signed.headers.get("cache-control")}`);
    check("Tampered signature is refused", (await fetch(`${BASE}${src.replace(/sig=[^&]+/, "sig=00000000000000000000000000000000")}`)).status === 403);
    check("Unsigned photo still needs a login", (await fetch(`${BASE}/api/photos/${photo}`)).status === 401);
  } else {
    check("Signed photo checks skipped (no approved demo photo in this database)", true);
  }
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
} finally {
  sql(`DELETE FROM "Advertisement" WHERE advertiser = 'Lakshmi Studios (test)'`);
  sql(`UPDATE "User" SET "whatsappOptIn" = false WHERE phone IN ('+919000000100','+919000000101','+919000000102','+919000000104')`);
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
