// End-to-end smoke test for Devangar Matrimony, driven through the installed Edge browser.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

// sharp is resolved from the app itself (the parent folder), so the suites need no copy of it.
const require = createRequire(new URL("../package.json", import.meta.url));
const sharp = require("sharp");

const BASE = "http://localhost:3000";
const LOG = process.argv[2];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

function latestOtp(phone10) {
  const text = readFileSync(LOG, "utf8");
  const re = new RegExp(`\\[OTP\\] \\+91${phone10}: (\\d{6})`, "g");
  let m, last = null;
  while ((m = re.exec(text))) last = m[1];
  return last;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitOtp(phone10, previous = null) {
  for (let i = 0; i < 40; i++) {
    const code = latestOtp(phone10);
    if (code && code !== previous) return code;
    await sleep(250);
  }
  throw new Error(`No OTP logged for ${phone10}`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const cspViolations = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) cspViolations.push(msg.text());
  });
  page.on("pageerror", (err) => cspViolations.push(`pageerror: ${err.message}`));
  return { ctx, page };
}
async function login(page, phone, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|verify|profile\/edit|admin)/, { timeout: 30000 });
}
const alertText = (page) => page.locator('form [role="alert"]').first().innerText({ timeout: 15000 });

const phone = `98${String(Date.now()).slice(-8)}`;
const password = "Secure123";

try {
  // ── Security headers ──────────────────────────────────────────────
  const res = await fetch(`${BASE}/`);
  const h = Object.fromEntries(res.headers);
  check("CSP header with nonce", /script-src[^;]*'nonce-/.test(h["content-security-policy"] ?? ""));
  check("X-Frame-Options DENY", h["x-frame-options"] === "DENY");
  check("HSTS + nosniff + referrer policy", !!h["strict-transport-security"] && h["x-content-type-options"] === "nosniff" && !!h["referrer-policy"]);
  check("No X-Powered-By header", !h["x-powered-by"]);
  for (const path of ["/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/opengraph-image", "/apple-icon.png"]) {
    const r = await fetch(`${BASE}${path}`);
    check(`GET ${path}`, r.status === 200, `${r.status} ${r.headers.get("content-type")}`);
  }
  check("Unknown page shows styled 404", (await fetch(`${BASE}/no-such-page`)).status === 404);

  // ── Registration with weak password rejected, then OTP ────────────
  const { ctx: userCtx, page } = await newPage();
  await page.goto(`${BASE}/register`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', "abcdefgh");
  await page.fill('input[name="confirm"]', "abcdefgh");
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  check("Weak password rejected", /letter and one number/.test(await alertText(page)));
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirm"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/verify/);
  const otp = await waitOtp(phone);
  await page.fill('input[name="code"]', otp);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/profile\/edit/);
  check("Register + OTP verify reaches profile creation", true);

  // ── Profile with contact details rejected ─────────────────────────
  const sel = (n, v) => page.selectOption(`select[name="${n}"]`, v);
  await sel("profileFor", "SELF");
  await page.fill('input[name="name"]', "Test Groom");
  await sel("gender", "MALE");
  await page.fill('input[name="dateOfBirth"]', "1995-05-05");
  await sel("maritalStatus", "NEVER_MARRIED");
  await sel("motherTongue", "Telugu");
  await sel("star", "Rohini");
  await sel("rasi", "Rishabam");
  await page.fill('input[name="education"]', "B.E. Mechanical");
  await page.fill('input[name="occupation"]', "Engineer");
  await page.selectOption('#city-choice', "Salem");
  await page.fill('textarea[name="about"]', "Call me on 98765 43210 anytime");
  await page.click('button[type="submit"]:has-text("Create profile")');
  check("Phone number in 'about' rejected", /remove phone numbers/.test(await alertText(page)));
  await page.fill('textarea[name="about"]', "Family-oriented engineer who enjoys music and travel with family.");
  await page.click('button[type="submit"]:has-text("Create profile")');
  await page.waitForURL(/\/photos/);
  check("Profile created", true);

  // ── Photo upload strips GPS EXIF, makes WebP + thumbnail ─────────
  const jpeg = await sharp({ create: { width: 2400, height: 3000, channels: 3, background: { r: 180, g: 120, b: 90 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "11/1 39/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "78/1 8/1 0/1" } })
    .toBuffer();
  const inMeta = await sharp(jpeg).metadata();
  await page.setInputFiles('input[name="photo"]', { name: "me.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.click('button[type="submit"]:has-text("Upload")');
  await page.locator('form [role="status"]').first().waitFor({ timeout: 30000 });
  const photoSrc = await page.locator("main img").first().getAttribute("src");
  const photoId = photoSrc.split("/").pop().split("?")[0];
  const full = await page.request.get(`${BASE}/api/photos/${photoId}`);
  const fullBuf = Buffer.from(await full.body());
  const fullMeta = await sharp(fullBuf).metadata();
  const thumbBuf = Buffer.from(await (await page.request.get(`${BASE}/api/photos/${photoId}?size=thumb`)).body());
  const thumbMeta = await sharp(thumbBuf).metadata();
  check("Upload had GPS EXIF going in", !!inMeta.exif);
  check("Served photo has no EXIF/GPS", !fullMeta.exif, `format=${fullMeta.format}`);
  check("Full image resized to ≤1200px WebP", fullMeta.format === "webp" && fullMeta.width <= 1200, `${fullMeta.width}x${fullMeta.height}, ${(fullBuf.length / 1024).toFixed(0)} KB (input ${(jpeg.length / 1024).toFixed(0)} KB)`);
  check("Thumbnail 480x600", thumbMeta.width === 480 && thumbMeta.height === 600, `${(thumbBuf.length / 1024).toFixed(1)} KB`);
  const etag = full.headers()["etag"];
  const revalidate = await page.request.get(`${BASE}/api/photos/${photoId}`, { headers: { "If-None-Match": etag } });
  check("Photo ETag returns 304", revalidate.status() === 304);
  check("Signed-out photo request refused", (await fetch(`${BASE}/api/photos/${photoId}`)).status === 401);

  // ── Admin approves profile + photo, activity is logged ───────────
  const { ctx: adminCtx, page: admin } = await newPage();
  await login(admin, "9000000000", "admin12345");
  check("Staff land in the admin portal", /\/admin$/.test(admin.url()), admin.url());
  await admin.goto(`${BASE}/admin/approvals?mode=list`);
  await admin.locator("tr", { hasText: "Test Groom" }).locator('a:has-text("Review")').click();
  await admin.waitForURL(/approvals\?id=/);
  await admin.locator('button:has-text("Approve photo")').first().click();
  await admin.locator("text=Approved").first().waitFor({ timeout: 15000 });
  await admin.locator('button:has-text("Approve profile")').click();
  await admin.waitForLoadState("networkidle");
  await admin.goto(`${BASE}/admin/activity`);
  const activity = await admin.locator("main").innerText();
  check("Admin actions logged", /Approved profile/.test(activity) && /Approved photo/.test(activity));

  // ── Porutham, interest with email rejected, interest sent ────────
  await page.goto(`${BASE}/dashboard`);
  const visible = (loc) => loc.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  check("Dashboard shows profile strength meter", await visible(page.locator("text=Profile strength")));
  await page.goto(`${BASE}/profiles/DM90002`);
  const poruthamText = await page.locator("section", { hasText: "Thirumana porutham" }).innerText();
  const score = poruthamText.match(/(\d+)\s*of\s*(\d+)/);
  check("Porutham card shown", !!score, score ? `${score[1]}/${score[2]} for Rohini/Rishabam × Hastham/Kanni` : "");
  await page.fill('textarea[name="message"]', "Mail me at test@example.com");
  await page.click('button:has-text("Send interest")');
  check("Email in interest message rejected", /remove email/.test(await alertText(page)));
  await page.fill('textarea[name="message"]', "Our family would like to connect.");
  await page.click('button:has-text("Send interest")');
  await page.locator("text=Interest sent ·").waitFor({ timeout: 15000 });
  check("Interest sent", true);

  // ── Bride sees viewer + accepts; contact appears for groom ───────
  const { ctx: brideCtx, page: bride } = await newPage();
  await login(bride, "9000000101", "demo12345");
  await bride.goto(`${BASE}/dashboard`);
  const viewedSection = await visible(bride.locator("text=Recently viewed your profile"));
  check("'Recently viewed your profile' lists the groom", viewedSection && (await visible(bride.locator("main a", { hasText: "Test Groom" }))));
  await bride.goto(`${BASE}/interests`);
  await bride.locator("section", { hasText: "Test Groom" }).locator('button:has-text("Accept")').click();
  await bride.waitForLoadState("networkidle");
  await page.goto(`${BASE}/profiles/DM90002`);
  check("Contact number revealed after acceptance", await page.locator("text=You are connected").isVisible());

  // ── Block hides both ways ─────────────────────────────────────────
  const groomCode = (await page.goto(`${BASE}/profile/edit`), await page.locator("p.eyebrow").first().innerText()).match(/DM\d+/)[0];
  bride.on("dialog", (d) => d.accept());
  check("Bride can see groom's approved photo before blocking", (await bride.request.get(`${BASE}/api/photos/${photoId}`)).status() === 200);
  await bride.goto(`${BASE}/profiles/${groomCode}`);
  await bride.click('button:has-text("Block member")');
  await bride.waitForURL(/\/settings\?blocked=1/);
  const blockedStatus = (await page.goto(`${BASE}/profiles/DM90002`)).status();
  check("Blocked member's profile is hidden (404)", blockedStatus === 404);
  check("Blocked member's photo is hidden", (await bride.request.get(`${BASE}/api/photos/${photoId}`)).status() === 404);
  await bride.goto(`${BASE}/settings`);
  await bride.locator("li", { hasText: groomCode }).locator('button:has-text("Unblock")').click();
  await bride.waitForLoadState("networkidle");

  // ── Login rate limiting ───────────────────────────────────────────
  const { ctx: attackerCtx, page: attacker } = await newPage();
  let limited = false;
  for (let i = 0; i < 10 && !limited; i++) {
    await attacker.goto(`${BASE}/login`);
    await attacker.fill('input[name="phone"]', phone);
    await attacker.fill('input[name="password"]', `Wrong${i}pass`);
    await attacker.click('button[type="submit"]');
    limited = /Too many attempts/.test(await alertText(attacker));
  }
  check("Brute-force login is rate limited", limited);

  // ── Password reset signs out other sessions ───────────────────────
  const { ctx: resetCtx, page: reset } = await newPage();
  const before = latestOtp(phone);
  await reset.goto(`${BASE}/forgot-password`);
  await reset.fill('input[name="phone"]', phone);
  await reset.click('button[type="submit"]');
  await reset.waitForURL(/\/reset-password/);
  const resetOtp = await waitOtp(phone, before);
  await reset.fill('input[name="code"]', resetOtp);
  await reset.fill('input[name="password"]', "Newpass456");
  await reset.fill('input[name="confirm"]', "Newpass456");
  await reset.click('button[type="submit"]');
  await reset.waitForURL(/\/dashboard/);
  check("Password reset via OTP logs in", true);
  await page.goto(`${BASE}/dashboard`);
  // Pages with a loading skeleton stream first, then redirect client-side.
  const revoked = await page.waitForURL(/\/login/, { timeout: 10000 }).then(() => true, () => false);
  check("Old session revoked after reset", revoked, page.url());

  // ── Account deletion ──────────────────────────────────────────────
  reset.on("dialog", (d) => d.accept());
  await reset.goto(`${BASE}/settings`);
  await reset.fill('section:has-text("Delete account") input[name="password"]', "Newpass456");
  await reset.fill('input[name="confirmText"]', "DELETE");
  await reset.click('button:has-text("Delete my account")');
  await reset.waitForURL(/\/\?deleted=1/);
  check("Account deleted", await reset.locator("text=permanently deleted").isVisible());
  check("Deleted user cannot log in", await (async () => {
    await reset.goto(`${BASE}/login`);
    await reset.fill('input[name="phone"]', phone);
    await reset.fill('input[name="password"]', "Newpass456");
    await reset.click('button[type="submit"]');
    return /Incorrect mobile number or password|Too many attempts/.test(await alertText(reset));
  })());

  check("No CSP violations or page errors in browser", cspViolations.length === 0, cspViolations.slice(0, 3).join(" | "));
  await Promise.all([userCtx, adminCtx, brideCtx, attackerCtx, resetCtx].map((c) => c.close()));
} catch (err) {
  check("Test run completed without exceptions", false, err.message.split("\n")[0]);
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
