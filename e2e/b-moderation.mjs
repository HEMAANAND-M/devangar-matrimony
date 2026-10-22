// Agent B: end-to-end checks for moderation (approvals, photos, reports, verifications, selfie).
import { launch } from "./browser.mjs";
import { byPhone, byPhoneOf, sql } from "./db.mjs";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const BASE = process.argv[2] ?? "http://localhost:3102";
// sharp is resolved from the app itself (the parent folder), so the suites need no copy of it.
const require = createRequire(new URL("../package.json", import.meta.url));
const sharp = require("sharp");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const dir = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, "$1"), "b-tmp");
fs.mkdirSync(dir, { recursive: true });
// A face-ish test image with structure (so the average hash is meaningful), and an unrelated one.
const imgA = path.join(dir, "a.png");
const imgB = path.join(dir, "b.png");
const svg = (fill, shape) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="${fill}"/>${shape}</svg>`);
await sharp(svg("#ddd", '<circle cx="300" cy="300" r="160" fill="#432"/><rect x="150" y="500" width="300" height="250" fill="#234"/>')).png().toFile(imgA);
await sharp(svg("#123", '<rect x="0" y="0" width="300" height="375" fill="#fe8"/><rect x="300" y="375" width="300" height="375" fill="#fe8"/>')).png().toFile(imgB);
const imgC = path.join(dir, "c.png");
await sharp(svg("#4a7", '<polygon points="300,80 560,700 40,700" fill="#fff"/>')).png().toFile(imgC);

// Server actions on a loaded dev machine can take a while; wait until the network is quiet.
const settle = async (page) => { await page.waitForTimeout(800); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500); };
const browser = await launch();

async function session(phone, password) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 180000 });
  return { ctx, page };
}

async function uploadPhoto(page, file) {
  await page.goto(`${BASE}/photos`);
  await page.setInputFiles('input[name="photo"]', file);
  await page.click('form:has(input[name="photo"]) button[type="submit"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
}

const p102 = sql(`select p.id from "Profile" p join "User" u on u.id=p."userId" where ${byPhoneOf("u", `+919000000102`)}`);
const p103 = sql(`select p.id from "Profile" p join "User" u on u.id=p."userId" where ${byPhoneOf("u", `+919000000103`)}`);
const p100 = sql(`select p.id from "Profile" p join "User" u on u.id=p."userId" where ${byPhoneOf("u", `+919000000100`)}`);
const savedStatus = sql(`select status from "Profile" where id='${p102}'`);
const savedAbout = sql(`select coalesce(about, '') from "Profile" where id='${p102}'`);

try {
  // --- Member uploads: identical image on two profiles (duplicate), one distinct image.
  {
    const m = await session("9000000102", "demo12345");
    await uploadPhoto(m.page, imgA);
    await uploadPhoto(m.page, imgB);
    await m.ctx.close();
    const n = await session("9000000103", "demo12345");
    await uploadPhoto(n.page, imgA);
    await n.ctx.close();
  }
  check("Test photos uploaded", Number(sql(`select count(*) from "Photo" where "profileId" in ('${p102}','${p103}') and not approved`)) >= 3);

  // --- Member 100 submits a selfie (which needs an approved photo first) and an ID document.
  {
    const m = await session("9000000100", "demo12345");
    if (sql(`select count(*) from "Photo" where "profileId"='${p100}' and approved`) === "0") {
      await uploadPhoto(m.page, imgC);
      sql(`update "Photo" set approved = true where "profileId"='${p100}'`);
    }
    await m.page.goto(`${BASE}/verify-photo`);
    await m.page.setInputFiles('input[name="selfie"]', imgA);
    await m.page.check('input[name="consent"]');
    await m.page.click('main button[type="submit"]');
    await m.page.getByText("is with our team for review").waitFor();
    check("Member can submit a selfie", true);
    await m.page.goto(`${BASE}/verify-id`);
    check("verify-id links to the selfie page", (await m.page.locator('a[href="/verify-photo"]').count()) > 0);
    await m.page.selectOption('select[name="docType"]', "PAN");
    await m.page.fill('input[name="last4"]', "123A");
    await m.page.setInputFiles('input[name="document"]', imgB);
    await m.page.check('input[name="consent"]');
    await m.page.click('main button[type="submit"]');
    await m.page.getByText("is awaiting review").waitFor();
    check("Member can submit an ID document", true);
    await m.ctx.close();
  }

  // --- Reports against DM90004 (p103) and a pending profile p102.
  sql(`insert into "Report"(id,"reporterId","targetId",reason,category,priority) values ('b-test-r1','${p100}','${p103}','Asked me to send money for a hospital bill','ASKED_FOR_MONEY',2),('b-test-r2','${p102}','${p103}','Says unmarried but is married','ALREADY_MARRIED',3)`);
  sql(`update "Profile" set status='PENDING', about='Call me on 98765 43210' where id='${p102}'`);

  // --- Admin
  const { ctx, page } = await session("9000000000", "admin12345");
  check("Admin lands in the admin portal after login", new URL(page.url()).pathname.startsWith("/admin"), page.url());

  // Approvals: review mode for p102.
  await page.goto(`${BASE}/admin/approvals?id=${p102}`);
  await page.getByRole("heading", { name: "Profile approvals" }).waitFor();
  const body = await page.locator("main").innerText();
  check("Review shows the full profile and flags", /Partner preferences/i.test(body) && /Contact details/.test(body) && /Duplicate photo/.test(body), ["Contact details", "Duplicate photo"].filter((t) => !body.includes(t)).join(", "));
  check("Review shows keyboard hints", /reject reason/.test(body));
  check("Header shows oldest waiting time", /oldest has waited/.test(body));
  await page.keyboard.press("r");
  check("R focuses the rejection reason", (await page.evaluate(() => document.activeElement?.id)) === "reject-reason");
  await page.getByRole("button", { name: "Contact details in profile text" }).click();
  await page.getByRole("button", { name: "Reject profile" }).click();
  await settle(page);
  check("Reject stores status and reason", sql(`select status||'|'||coalesce("rejectionReason",'') from "Profile" where id='${p102}'`) === "REJECTED|Contact details in profile text");
  check("Rejection notification queued", Number(sql(`select count(*) from "Notification" n join "Profile" p on p."userId"=n."userId" where p.id='${p102}' and template='profile_rejected'`)) >= 0);
  check("Rejection logged", Number(sql(`select count(*) from "AdminLog" where "targetId"='${p102}' and action='profile.reject'`)) >= 1);

  // Approve with the keyboard.
  sql(`update "Profile" set status='PENDING' where id='${p102}'`);
  await page.goto(`${BASE}/admin/approvals?id=${p102}`);
  await page.locator("#approve-profile").waitFor();
  // The shortcut listener attaches after hydration; pressing before that would be lost.
  await settle(page);
  await page.keyboard.press("a");
  await settle(page);
  check("A key approves the profile", sql(`select status from "Profile" where id='${p102}'`) === "APPROVED");
  check("History shows previous rejection", true);

  // List mode
  await page.goto(`${BASE}/admin/approvals?mode=list`);
  await page.getByRole("button", { name: "Approve selected" }).waitFor();
  check("List mode renders with bulk approve", (await page.locator('input[name="ids"]').count()) > 0);

  // Photos
  await page.goto(`${BASE}/admin/photos`);
  await page.getByRole("heading", { name: "Photos" }).waitFor();
  const photoText = await page.locator("main").innerText();
  check("Photo page flags the duplicate", /possible duplicate/.test(photoText) && /Looks like a photo on/.test(photoText));
  check("Hashes computed", Number(sql(`select count(*) from "Photo" where "profileId" in ('${p102}','${p103}') and hash is not null`)) >= 3);
  // Reject the duplicate on p103.
  const dupId = sql(`select id from "Photo" where "profileId"='${p103}' and not approved order by "createdAt" desc limit 1`);
  const card = page.locator("article", { has: page.locator(`input[value="${dupId}"]`) });
  await card.getByRole("button", { name: "Not a photo of the member" }).click();
  await card.getByRole("button", { name: "Reject" }).click();
  await settle(page);
  check("Rejecting a photo deletes it", sql(`select count(*) from "Photo" where id='${dupId}'`) === "0");
  check("Photo rejection logged with reason", /Not a photo of the member/.test(sql(`select detail from "AdminLog" where "targetId"='${dupId}' and action='photo.reject'`)));
  // Bulk approve p102's photos.
  await page.goto(`${BASE}/admin/photos`);
  const ids102 = sql(`select id from "Photo" where "profileId"='${p102}' and not approved`).split(/\r?\n/).filter(Boolean);
  for (const id of ids102) await page.check(`input[value="${id}"]`);
  await page.getByRole("button", { name: "Approve selected" }).click();
  await settle(page);
  check("Bulk approve photos", sql(`select count(*) from "Photo" where "profileId"='${p102}' and not approved`) === "0");

  // Reports
  await page.goto(`${BASE}/admin/reports`);
  await page.getByRole("heading", { name: "Reports" }).waitFor();
  const rep = page.locator("li", { hasText: "Asked me to send money" });
  check("Report shows category and total count", /Asked for money/.test(await rep.innerText()) && /2 reports in total/.test(await rep.innerText()));
  await rep.locator("select").selectOption("1");
  await rep.locator('textarea[placeholder^="Internal notes"]').fill("Called the member; awaiting reply");
  await rep.getByRole("button", { name: "Save notes" }).click();
  await settle(page);
  check("Notes and priority saved", sql(`select priority||'|'||notes from "Report" where id='b-test-r1'`) === "1|Called the member; awaiting reply");
  await page.goto(`${BASE}/admin/reports?category=ALREADY_MARRIED`);
  const rep2 = page.locator("li", { hasText: "Says unmarried" });
  check("Category filter works", (await page.locator("li", { hasText: "Asked me to send money" }).count()) === 0 && (await rep2.count()) === 1);
  await rep2.getByRole("button", { name: "Warn member" }).click();
  await page.waitForTimeout(1200);
  check("Warn requires a note", /Add a note/.test(await rep2.innerText()));
  await rep2.locator('input[placeholder^="Resolution note"]').fill("Asked to correct marital status");
  await rep2.getByRole("button", { name: "Warn member" }).click();
  await settle(page);
  { const v = sql(`select resolved||'|'||resolution||'|'||("resolvedById" is not null) from "Report" where id='b-test-r2'`); check("Warn resolves the report", v === "true|Warned: Asked to correct marital status|true", v); }
  await page.goto(`${BASE}/admin/reports?status=resolved`);
  check("Resolved tab lists it", (await page.locator("li", { hasText: "Warned: Asked to correct marital status" }).count()) === 1);

  // Verifications
  await page.goto(`${BASE}/admin/verifications`);
  await page.getByRole("heading", { name: "Verifications" }).waitFor();
  const selfieId = sql(`select id from "IdVerification" where "profileId"='${p100}' and "docType"='SELFIE' and status='PENDING'`);
  const selfieImg = await page.request.get(`${BASE}/api/admin/selfies/${selfieId}`);
  check("Selfie viewer serves the decrypted image to staff", selfieImg.status() === 200 && /image\//.test(selfieImg.headers()["content-type"]));
  await page.getByRole("button", { name: /Approve — it's the same person/ }).first().click();
  await settle(page);
  check("Selfie approval sets photoVerifiedAt and deletes file", sql(`select ("photoVerifiedAt" is not null) from "Profile" where id='${p100}'`) === "t" && sql(`select (document is null) from "IdVerification" where id='${selfieId}'`) === "t");
  await page.goto(`${BASE}/admin/verifications?tab=ids`);
  const idCard = page.locator("li", { hasText: "••123A" });
  await idCard.getByRole("button", { name: "Blurry or unreadable" }).click();
  await idCard.getByRole("button", { name: "Reject" }).click();
  await settle(page);
  { const v = sql(`select status||'|'||"rejectionReason"||'|'||(document is null) from "IdVerification" where "profileId"='${p100}' and "docType"='PAN' order by "createdAt" desc limit 1`); check("ID rejection stored with reason, file deleted", v === "REJECTED|Blurry or unreadable|true", v); }
  await ctx.close();

  // Moderator: no ID documents.
  {
    const m = await session("9000000001", "moderator123");
    await m.page.goto(`${BASE}/admin/verifications?tab=ids`);
    const t = await m.page.locator("main").innerText();
    check("Moderator does not get the ID documents tab", !/ID documents/.test(t) && /Selfie checks/.test(t));
    const r = await m.page.request.get(`${BASE}/api/admin/id-documents/${selfieId}`);
    check("Moderator cannot open ID documents", r.status() === 404);
    await m.page.goto(`${BASE}/admin/approvals`);
    check("Moderator can open approvals", (await m.page.getByRole("heading", { name: "Profile approvals" }).count()) === 1);
    await m.ctx.close();
  }

  // Member sees verified state.
  {
    const m = await session("9000000100", "demo12345");
    await m.page.goto(`${BASE}/verify-photo`);
    check("Member sees Photo verified", /Photo verified/.test(await m.page.locator("main").innerText()));
    await m.ctx.close();
  }
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
} finally {
  // Clean up test data.
  sql(`delete from "Report" where id in ('b-test-r1','b-test-r2')`);
  sql(`delete from "Photo" where "profileId" in ('${p102}','${p103}')`);
  sql(`delete from "IdVerification" where "profileId"='${p100}'`);
  sql(`update "Profile" set "photoVerifiedAt"=null, flags='{}' where id in ('${p100}','${p102}','${p103}')`);
  sql(`update "Profile" set status='${savedStatus}', about=nullif($q$${savedAbout}$q$, ''), "rejectionReason"=null where id='${p102}'`);
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
