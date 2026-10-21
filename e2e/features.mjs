// E2E checks for premium, ID verification, watermark, protected photos, family accounts,
// moderators and WhatsApp notifications. Usage: node features.mjs <server-log-file>
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

// sharp is resolved from the app itself (the parent folder), so the suites need no copy of it.
const require = createRequire(new URL("../package.json", import.meta.url));
const sharp = require("sharp");
const BASE = "http://localhost:3000";
const LOG = process.argv[2];
const PSQL = "C:/Program Files/PostgreSQL/17/bin/psql.exe";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const sql = (q) =>
  execFileSync(PSQL, ["-U", "postgres", "-h", "localhost", "-d", "devangar_matrimony", "-tAc", q], { env: { ...process.env, PGPASSWORD: "devangar_local" } })
    .toString()
    .trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function latestOtp(phone10) {
  const re = new RegExp(`\\[OTP\\] \\+91${phone10}: (\\d{6})`, "g");
  let m, last = null;
  const text = readFileSync(LOG, "utf8");
  while ((m = re.exec(text))) last = m[1];
  return last;
}
async function waitOtp(phone10) {
  for (let i = 0; i < 40; i++) {
    const c = latestOtp(phone10);
    if (c) return c;
    await sleep(250);
  }
  throw new Error(`no OTP for ${phone10}`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const pageErrors = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && pageErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}
async function login(page, phone, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|verify|profile\/edit|admin)/, { timeout: 30000 });
}
async function register(page, phone, password, { whatsapp = false } = {}) {
  await page.goto(`${BASE}/register`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirm"]', password);
  await page.check('input[name="terms"]');
  if (whatsapp) await page.check('input[name="whatsapp"]');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/verify/);
  await page.fill('input[name="code"]', await waitOtp(phone));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/profile\/edit/);
}
const visible = (loc, timeout = 10000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const formMsg = (page, role) => page.locator(`form [role="${role}"]`).first().innerText({ timeout: 15000 }).catch(() => "");

const stamp = String(Date.now()).slice(-7);
const groomPhone = `981${stamp}`;
const fatherPhone = `982${stamp}`;
const pw = "Secure123";

try {
  // ── Groom registers with WhatsApp opt-in and creates a profile ───
  const groom = await newPage();
  await register(groom, groomPhone, pw, { whatsapp: true });
  check("WhatsApp opt-in saved at registration", sql(`select "whatsappOptIn" from "User" where phone='+91${groomPhone}'`) === "t");
  const sel = (n, v) => groom.selectOption(`select[name="${n}"]`, v);
  await sel("profileFor", "SELF");
  await groom.fill('input[name="name"]', "Feature Groom");
  await sel("gender", "MALE");
  await groom.fill('input[name="dateOfBirth"]', "1994-03-03");
  await sel("maritalStatus", "NEVER_MARRIED");
  await sel("motherTongue", "Telugu");
  await sel("star", "Rohini");
  await sel("rasi", "Rishabam");
  await groom.fill('input[name="education"]', "MBA");
  await groom.fill('input[name="occupation"]', "Manager");
  await groom.selectOption('#city-choice', "Erode");
  await groom.click('button[type="submit"]:has-text("Create profile")');
  await groom.waitForURL(/\/photos/);
  const groomCode = sql(`select p.code from "Profile" p join "User" u on u.id=p."userId" where u.phone='+91${groomPhone}'`);
  const groomProfileId = sql(`select id from "Profile" where code='${groomCode}'`);

  // ── Watermark is burned into uploaded photos ─────────────────────
  const solid = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: { r: 180, g: 120, b: 90 } } }).jpeg().toBuffer();
  await groom.setInputFiles('input[name="photo"]', { name: "me.jpg", mimeType: "image/jpeg", buffer: solid });
  await groom.click('button[type="submit"]:has-text("Upload")');
  await groom.locator('form [role="status"]').first().waitFor({ timeout: 30000 });
  const photoId = (await groom.locator("main img").first().getAttribute("src")).split("/").pop().split("?")[0];
  const full = Buffer.from(await (await groom.request.get(`${BASE}/api/photos/${photoId}`)).body());
  const meta = await sharp(full).metadata();
  // stats() reads the input image, so crop to a buffer first.
  const region = async (r) => sharp(await sharp(full).extract(r).toBuffer()).stats();
  const corner = await region({ left: Math.round(meta.width * 0.5), top: Math.round(meta.height * 0.85), width: Math.round(meta.width * 0.45), height: Math.round(meta.height * 0.12) });
  const topLeft = await region({ left: 0, top: 0, width: 200, height: 200 });
  check("Watermark visible in bottom-right of photo", corner.channels[0].stdev > 3 && topLeft.channels[0].stdev < 1,
    `corner stdev ${corner.channels[0].stdev.toFixed(1)} vs plain area ${topLeft.channels[0].stdev.toFixed(1)}`);

  // ── Moderator approves; WhatsApp notification queued ─────────────
  const mod = await newPage();
  await login(mod, "9000000001", "moderator123");
  check("Moderator lands in the moderation portal", /\/admin$/.test(mod.url()) && await visible(mod.locator("aside", { hasText: "Moderation" })), mod.url());
  const nav = await mod.locator("aside").innerText();
  check("Moderator cannot see payments, staff or settings", !/Payments|Staff|Settings/.test(nav));
  await mod.goto(`${BASE}/admin/payments`);
  check("Moderator is kept out of payments", !/\/admin\/payments/.test(mod.url()), mod.url());
  await mod.goto(`${BASE}/admin/approvals?mode=list`);
  check("Moderator does not see member phone numbers", !(await mod.locator("main").innerText()).includes(groomPhone));
  await mod.locator("tr", { hasText: "Feature Groom" }).locator('a:has-text("Review")').click();
  await mod.waitForURL(/approvals\?id=/);
  await mod.locator('button:has-text("Approve photo")').first().click();
  await mod.locator("text=Approved").first().waitFor({ timeout: 15000 });
  await mod.locator('button:has-text("Approve profile")').click();
  await mod.waitForLoadState("networkidle");
  await sleep(1000);
  check("Moderator approved profile", sql(`select status from "Profile" where id='${groomProfileId}'`) === "APPROVED");
  await sleep(1500);
  const approvedNote = sql(`select n.status from "Notification" n join "User" u on u.id=n."userId" where u.phone='+91${groomPhone}' and template='profile_approved'`);
  check("WhatsApp 'profile approved' recorded for opted-in member", approvedNote === "NOT_CONFIGURED", approvedNote || "none");

  // ── Interest → acceptance; free member cannot see contact ────────
  await groom.goto(`${BASE}/profiles/DM90002`);
  await groom.click('button:has-text("Send interest")');
  await visible(groom.locator("text=Interest sent ·"));
  check("No WhatsApp for member who did not opt in", sql(`select count(*) from "Notification" n join "User" u on u.id=n."userId" where u.phone='+919000000101'`) === "0");
  const bride = await newPage();
  await login(bride, "9000000101", "demo12345");
  await bride.goto(`${BASE}/interests`);
  await bride.locator("section", { hasText: "Feature Groom" }).locator('button:has-text("Accept")').click();
  await bride.waitForLoadState("networkidle");
  await sleep(1500);
  check("WhatsApp 'interest accepted' recorded for groom",
    sql(`select count(*) from "Notification" n join "User" u on u.id=n."userId" where u.phone='+91${groomPhone}' and template='interest_accepted'`) === "1");
  await groom.goto(`${BASE}/profiles/DM90002`);
  const freeHtml = await groom.content();
  check("Free member sees upgrade prompt, not the phone number", freeHtml.includes("Upgrade to request phone number") && !freeHtml.includes("+919000000101"));

  // ── Protected photo viewing ──────────────────────────────────────
  await bride.goto(`${BASE}/profiles/${groomCode}`);
  const img = bride.locator("main img[data-revealed]").first();
  const before = await img.getAttribute("data-revealed");
  await bride.locator('button[aria-label="Show photo"]').first().click();
  const after = await img.getAttribute("data-revealed");
  check("Photo blurred until tapped, then revealed", before === "false" && after === "true");
  const prevented = await bride.locator("main div.select-none").first().evaluate((el) => {
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  check("Right-click save is blocked on photos", prevented);

  // ── Premium upgrade (demo checkout) unlocks contact + badge ──────
  await groom.goto(`${BASE}/upgrade`);
  await groom.click('button:has-text("Choose Gold Plus")');
  await groom.click('button:has-text("Complete demo payment")');
  check("Demo checkout activates Premium", await visible(groom.locator("text=Welcome to Premium!")));
  const premiumUntil = sql(`select "premiumUntil" > now() + interval '5 months' from "Profile" where id='${groomProfileId}'`);
  check("Premium set for 6 months", premiumUntil === "t");
  await groom.goto(`${BASE}/profiles/DM90002`);
  check("Premium member does not see the number before approval", (await groom.locator("a[href='tel:+919000000101']").count()) === 0);
  await groom.locator("main button", { hasText: "Request phone number" }).click();
  await groom.getByText("Phone number requested").waitFor({ timeout: 20000 });
  await bride.goto(`${BASE}/interests`);
  await bride.locator("section", { hasText: "Phone number requests" }).locator("button", { hasText: "Share my number" }).click();
  await bride.waitForLoadState("networkidle");
  await sleep(1500);
  await groom.goto(`${BASE}/profiles/DM90002`);
  check("Premium member sees the number after the bride approves", await visible(groom.locator("a[href='tel:+919000000101']")));
  await bride.goto(`${BASE}/profiles/${groomCode}`);
  check("Premium badge shown on profile", await visible(bride.locator("main div.mt-3", { hasText: "Premium" })));

  // ── Razorpay webhook: signature + amount checks ──────────────────
  sql(`insert into "Payment"(id,"profileId",plan,months,amount,currency,status,demo,"razorpayOrderId","createdAt") values ('pay_test_${stamp}','${groomProfileId}','gold-3',3,199900,'INR','CREATED',false,'order_test_${stamp}',now())`);
  const event = (amount) => JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `pay_rzp_${stamp}_${amount}`, order_id: `order_test_${stamp}`, amount } } } });
  const sign = (body) => createHmac("sha256", "test_webhook_secret").update(body).digest("hex");
  const bad = await fetch(`${BASE}/api/razorpay/webhook`, { method: "POST", body: event(199900), headers: { "x-razorpay-signature": "deadbeef" } });
  check("Webhook rejects bad signature", bad.status === 400);
  const wrongAmount = event(100);
  await fetch(`${BASE}/api/razorpay/webhook`, { method: "POST", body: wrongAmount, headers: { "x-razorpay-signature": sign(wrongAmount) } });
  check("Webhook ignores mismatched amount", sql(`select status from "Payment" where id='pay_test_${stamp}'`) === "CREATED");
  const good = event(199900);
  const ok = await fetch(`${BASE}/api/razorpay/webhook`, { method: "POST", body: good, headers: { "x-razorpay-signature": sign(good) } });
  check("Webhook with valid signature marks payment paid", ok.status === 200 && sql(`select status from "Payment" where id='pay_test_${stamp}'`) === "PAID");
  const replay = await fetch(`${BASE}/api/razorpay/webhook`, { method: "POST", body: good, headers: { "x-razorpay-signature": sign(good) } });
  const months = sql(`select round(extract(epoch from ("premiumUntil" - now())) / 2592000) from "Profile" where id='${groomProfileId}'`);
  check("Replayed webhook does not extend twice", replay.status === 200 && Number(months) === 9, `${months} months total (6 + 3)`);

  // ── ID verification: encrypted, admin-only, deleted on review ────
  await groom.goto(`${BASE}/verify-id`);
  await groom.selectOption('select[name="docType"]', "AADHAAR");
  await groom.fill('input[name="last4"]', "4321");
  const idImg = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 240, g: 240, b: 230 } } }).jpeg().toBuffer();
  await groom.setInputFiles('input[name="document"]', { name: "aadhaar.jpg", mimeType: "image/jpeg", buffer: idImg });
  await groom.check('input[name="consent"]');
  await groom.click('button:has-text("Submit for verification")');
  check("ID document submitted", await visible(groom.locator("text=is awaiting review")));
  const vid = sql(`select id from "IdVerification" where "profileId"='${groomProfileId}' and status='PENDING'`);
  const stored = sql(`select encode(substring(document from 1 for 4),'hex') from "IdVerification" where id='${vid}'`);
  check("Document is encrypted at rest (not a readable image)", !stored.startsWith("52494646") && !stored.startsWith("ffd8"), `first bytes ${stored}`);
  check("Only last 4 digits stored", sql(`select last4 from "IdVerification" where id='${vid}'`) === "4321");
  check("Moderator cannot open ID documents", (await mod.request.get(`${BASE}/api/admin/id-documents/${vid}`)).status() === 404);
  check("Member cannot open ID documents", (await groom.request.get(`${BASE}/api/admin/id-documents/${vid}`)).status() === 404);
  const admin = await newPage();
  await login(admin, "9000000000", "admin12345");
  const docRes = await admin.request.get(`${BASE}/api/admin/id-documents/${vid}`);
  check("Admin can open decrypted document", docRes.status() === 200 && docRes.headers()["content-type"] === "image/webp" && /no-store/.test(docRes.headers()["cache-control"]));
  await admin.goto(`${BASE}/admin/verifications?tab=ids`);
  await admin.locator('button:has-text("Approve document")').first().click();
  await admin.waitForLoadState("networkidle");
  await sleep(1000);
  check("Document deleted after review", sql(`select document is null and status='APPROVED' from "IdVerification" where id='${vid}'`) === "t");
  check("Profile marked ID verified", sql(`select "idVerifiedAt" is not null from "Profile" where id='${groomProfileId}'`) === "t");
  await bride.goto(`${BASE}/profiles/${groomCode}`);
  check("'ID verified' badge shown", await visible(bride.locator("main div.mt-3", { hasText: "ID verified" })));

  // ── Admin sees payments, staff, notifications; manages moderators
  const adminNav = await admin.locator("aside").innerText();
  check("Admin sees payments, staff and communications", /Payments/.test(adminNav) && /Staff/.test(adminNav) && /Communications/.test(adminNav));
  await admin.goto(`${BASE}/admin/staff`);
  await admin.fill('main input[name="phone"]', "9000000103");
  await admin.click('button:has-text("Add moderator")');
  check("Admin can add a moderator", /moderator/i.test(await formMsg(admin, "status")));
  await admin.goto(`${BASE}/admin/staff`);
  await admin.locator("tr", { hasText: "+91 90••••••03" }).locator('button:has-text("Remove")').click();
  await admin.waitForLoadState("networkidle");
  await sleep(1000);
  check("Admin can remove a moderator", sql(`select role from "User" where phone='+919000000103'`) === "USER");

  // ── Family co-managed account ────────────────────────────────────
  await groom.goto(`${BASE}/settings`);
  await groom.fill('section:has-text("Family access") input[name="phone"]', fatherPhone);
  await groom.selectOption('section:has-text("Family access") select[name="relation"]', "FATHER");
  await groom.click('button:has-text("Invite")');
  check("Family invite created", /Invitation created/.test(await formMsg(groom, "status")));
  const father = await newPage();
  await register(father, fatherPhone, pw);
  check("Invitee sees invitation after registering", await visible(father.locator("text=Manage Feature Groom’s profile?")));
  await father.click('button:has-text("Accept invitation")');
  await father.waitForURL(/\/dashboard/);
  check("Family member's dashboard manages the groom's profile", await visible(father.locator(`text=Managing profile ${groomCode}`)));
  await father.goto(`${BASE}/profiles/DM90003`);
  await father.click('button:has-text("Send interest")');
  await visible(father.locator("text=Interest sent ·"));
  check("Family member can send interest on behalf of profile",
    sql(`select count(*) from "Interest" i join "Profile" t on t.id=i."toId" where i."fromId"='${groomProfileId}' and t.code='DM90003'`) === "1");
  await groom.goto(`${BASE}/settings`);
  check("Owner sees family member as active", await visible(groom.locator("li", { hasText: `+91${fatherPhone}` }).locator("text=active")));
  await father.goto(`${BASE}/settings`);
  check("Family member cannot invite others", (await father.locator('button:has-text("Invite")').count()) === 0);

  // ── Weekly cron is protected ─────────────────────────────────────
  check("Cron rejects requests without secret", (await fetch(`${BASE}/api/cron/weekly`)).status === 401);
  const cron = await fetch(`${BASE}/api/cron/weekly`, { headers: { Authorization: "Bearer test_cron_secret" } });
  const cronBody = cron.ok ? await cron.json() : {};
  check("Cron runs with secret", cron.status === 200 && "digestsSent" in cronBody, JSON.stringify(cronBody));

  check("No CSP violations or page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} catch (err) {
  check("Run completed without exceptions", false, err.message.split("\n")[0]);
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
