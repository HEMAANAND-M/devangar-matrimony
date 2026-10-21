// Agent C end-to-end: coupons, demo checkout with coupon, invoice, refund, CSV, announcements,
// support tickets, content pages, events and settings.
import { launch } from "./browser.mjs";

const BASE = process.argv[2] ?? "http://localhost:3103";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
page.setDefaultNavigationTimeout(240000);
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = () => page.waitForLoadState("networkidle").catch(() => {});
const stamp = Date.now().toString().slice(-5);
const COUPON = `TEST${stamp}`;

async function login(phone, password, expect) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL(expect, { timeout: 240000 });
  await settle();
}
async function logout() {
  await ctx.clearCookies();
}
const statusOk = async (path) => (await page.request.get(`${BASE}${path}`)).status();

try {
  // ——— Admin setup ———
  await login("9000000000", "admin12345", /\/admin/);
  check("Admin lands in admin portal", /\/admin/.test(page.url()), page.url());

  await page.goto(`${BASE}/admin/coupons`);
  await settle();
  check("Plans editor lists plans", (await page.locator('input[name^="name_"]').count()) >= 4);
  await page.locator("form", { has: page.locator('input[name="code"]') }).locator('input[name="code"]').fill(COUPON);
  await page.fill('input[name="value"]', "20");
  await page.click('button:has-text("Create coupon")');
  await page.locator(`text=Coupon ${COUPON} created.`).waitFor({ timeout: 180000 });
  check("Coupon created", true);
  await page.click('button:has-text("Save plans")');
  await page.locator("text=Plans saved.").waitFor({ timeout: 180000 });
  check("Plans saved", true);

  await page.goto(`${BASE}/admin/communications`);
  await settle();
  const annForm = page.locator("form", { has: page.locator('button:has-text("Publish")') });
  await annForm.locator('input[name="title"]').fill(`Sangam meet ${stamp}`);
  await annForm.locator('textarea[name="body"]').fill("Join us this Sunday in Coimbatore.");
  await annForm.locator('button:has-text("Publish")').click();
  await page.locator("text=Announcement published.").waitFor({ timeout: 180000 });
  check("Announcement published", true);
  await page.goto(`${BASE}/admin/communications?tab=notifications`);
  check("Message log renders", (await page.locator("h1", { hasText: "Communications" }).count()) === 1);
  await page.goto(`${BASE}/admin/communications?tab=templates`);
  check("Templates table lists premium_activated", (await page.locator("text=premium_activated").count()) > 0);

  await page.goto(`${BASE}/admin/content?tab=faq`);
  await page.click('button:has-text("Save FAQ")');
  await page.locator("text=FAQ saved.").waitFor({ timeout: 180000 });
  check("FAQ saved", true);
  await page.goto(`${BASE}/admin/content?tab=testimonials`);
  await page.fill('input[name="names_0"]', `Test Family ${stamp}`);
  await page.fill('textarea[name="quote_0"]', "We found a wonderful match here.");
  await page.click('button:has-text("Save testimonials")');
  await page.locator("text=Testimonials saved.").waitFor({ timeout: 180000 });
  check("Testimonials saved", true);
  await page.goto(`${BASE}/admin/content?tab=safety`);
  await page.click('button:has-text("Save safety page")');
  await page.locator("text=Safety page saved.").waitFor({ timeout: 180000 });
  check("Safety saved", true);
  await page.goto(`${BASE}/admin/content`);
  const storyForm = page.locator("form", { has: page.locator('button:has-text("Add story")') });
  await storyForm.locator('input[name="coupleNames"]').fill(`Anu & Ravi ${stamp}`);
  await storyForm.locator('textarea[name="story"]').fill("We met on Devangar Matrimony and our families clicked instantly.");
  await storyForm.locator('button:has-text("Add story")').click();
  await page.locator("text=Story added.").waitFor({ timeout: 180000 });
  check("Story added", true);

  await page.goto(`${BASE}/admin/events`);
  const evForm = page.locator("form", { has: page.locator('button:has-text("Add event")') });
  await evForm.locator('input[name="title"]').fill(`Community meet ${stamp}`);
  await evForm.locator('textarea[name="description"]').fill("Annual gathering.");
  await evForm.locator('input[name="location"]').fill("Coimbatore");
  await evForm.locator('input[name="startsAt"]').fill("2027-01-15T10:00");
  await evForm.locator('button:has-text("Add event")').click();
  await page.locator("text=Event added.").waitFor({ timeout: 180000 });
  check("Event added", true);

  await page.goto(`${BASE}/admin/settings`);
  await page.click('button:has-text("Save switches")');
  await page.locator("text=Feature switches saved.").waitFor({ timeout: 180000 });
  check("Feature switches saved", true);
  await page.click('button:has-text("Save lists")');
  await page.locator("text=Dropdown lists saved.").waitFor({ timeout: 180000 });
  check("Lists saved", true);
  await logout();

  // ——— Member ———
  await login("9000000101", "demo12345", /\/dashboard/);
  await page.waitForTimeout(800);
  check("Announcement banner visible", (await page.locator(`text=Sangam meet ${stamp}`).count()) > 0);
  await page.click(`button[aria-label="Dismiss: Sangam meet ${stamp}"]`);
  await page.reload();
  await settle();
  await page.waitForTimeout(800);
  check("Dismissed announcement stays hidden", (await page.locator(`text=Sangam meet ${stamp}`).count()) === 0);

  await page.goto(`${BASE}/upgrade?coupon=nonexistent`);
  check("Invalid coupon message", (await page.locator("text=This coupon is not valid.").count()) > 0);
  await page.goto(`${BASE}/upgrade?coupon=${COUPON.toLowerCase()}`);
  await settle();
  check("Coupon shows savings", (await page.locator("text=You save").count()) >= 1);
  await page.locator("main section button").first().click();
  await page.locator('button:has-text("Complete demo payment")').click();
  await page.locator("text=Welcome to Premium!").waitFor({ timeout: 180000 });
  check("Demo checkout with coupon completes", true);
  await page.goto(`${BASE}/upgrade?coupon=${COUPON}`);
  check("Same coupon cannot be used twice by one profile", (await page.locator("text=You have already used this coupon.").count()) > 0);
  await page.goto(`${BASE}/upgrade`);
  const invoiceLink = page.locator('a:has-text("Invoice")').first();
  check("Payment listed with invoice", (await invoiceLink.count()) > 0);
  await invoiceLink.click();
  await page.waitForURL(/\/invoices\//);
  const invoiceText = await page.locator("article").innerText();
  check("Invoice has number, coupon and GST", /DEMO\/\d{4}-\d{2}\/\d{6}/.test(invoiceText) && invoiceText.includes(COUPON) && /CGST/.test(invoiceText), invoiceText.match(/DEMO\/\S+/)?.[0]);
  const invoiceUrl = page.url();

  await page.goto(`${BASE}/support`);
  await page.fill('input[name="subject"]', `Help ${stamp}`);
  await page.fill('textarea[name="message"]', "My payment went through but I need an invoice copy.");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/support\/\w+/, { timeout: 180000 });
  const ticketUrl = page.url();
  check("Member ticket created", true, ticketUrl);
  await logout();

  // Other member cannot see invoice.
  await login("9000000103", "demo12345", /\/dashboard/);
  await page.goto(invoiceUrl);
  check("Another member gets 404 on invoice", (await page.locator("text=404").count()) > 0);
  await page.goto(ticketUrl);
  check("Another member gets 404 on ticket", (await page.locator("text=404").count()) > 0);
  await logout();

  // ——— Admin follow-up ———
  await login("9000000000", "admin12345", /\/admin/);
  await page.goto(`${BASE}/admin/support`);
  await page.locator(`a:has-text("Help ${stamp}")`).click();
  await page.waitForURL(/\/admin\/support\//);
  await page.fill('textarea[name="message"]', "Your invoice is on the Premium page.");
  await page.click('button:has-text("Send reply")');
  await page.locator("text=Reply sent.").waitFor({ timeout: 180000 });
  check("Staff reply sent", true);

  await page.goto(`${BASE}/admin/payments?q=${COUPON}`);
  await settle();
  check("Payment filter by coupon finds it", (await page.locator(`tbody >> text=${COUPON}`).count()) > 0);
  await page.locator("summary", { hasText: "Refund" }).first().click();
  await page.locator('button:has-text("Refund payment")').first().click();
  await page.locator("tbody tr", { hasText: COUPON }).locator("text=Refunded").first().waitFor({ timeout: 60000 });
  check("Refund recorded", true);
  await page.goto(`${BASE}/admin/payments?status=REFUNDED&q=${COUPON}`);
  check("Refunded filter shows it", (await page.locator("tbody tr").count()) >= 1);
  const csv = await page.request.get(`${BASE}/api/admin/export/payments?status=REFUNDED`);
  const body = await csv.text();
  check("CSV export", csv.status() === 200 && body.includes("Invoice") && body.includes(COUPON), `${csv.status()}`);
  await page.goto(invoiceUrl);
  check("Admin can open member invoice; shows refunded", (await page.locator("article >> text=Refunded").count()) > 0);
  await page.goto(`${BASE}/admin/coupons`);
  check("Coupon use counted", (await page.locator("tr", { hasText: COUPON }).locator("td").nth(3).innerText()).trim() === "1");
  await logout();

  // ——— Public pages ———
  await page.goto(`${BASE}/support`);
  await page.fill('input[name="name"]', "Visitor");
  await page.fill('input[name="phone"]', "9876500000");
  await page.fill('input[name="subject"]', `Visitor ${stamp}`);
  await page.fill('textarea[name="message"]', "Is registration free for parents?");
  await page.click('main button[type="submit"]');
  await page.locator("text=we have received your message").waitFor({ timeout: 180000 });
  check("Signed-out contact form", true);
  for (const p of ["/stories", "/faq", "/events", "/safety", "/"]) {
    check(`${p} returns 200`, (await statusOk(p)) === 200);
  }
  await page.goto(`${BASE}/`);
  check("Home shows testimonial", (await page.locator(`text=Test Family ${stamp}`).count()) > 0);
  await page.goto(`${BASE}/events`);
  check("Event listed", (await page.locator(`text=Community meet ${stamp}`).count()) > 0);
  await page.goto(`${BASE}/stories`);
  check("Story listed", (await page.locator(`text=Anu & Ravi ${stamp}`).count()) > 0);
  check("Footer has new links", (await page.locator('footer a[href="/stories"]').count()) === 1 && (await page.locator('footer a[href="/faq"]').count()) === 1);
  check("No client errors", errors.length === 0, errors.join(" | ").slice(0, 300));
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
  await page.screenshot({ path: "c-fail.png", fullPage: true }).catch(() => {});
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
