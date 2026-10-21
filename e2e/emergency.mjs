// Admin "Emergency: sign out everyone": members are signed out, the acting admin is not.
import { launch } from "./browser.mjs";
const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const browser = await launch();
async function login(phone, password, landing) {
  const page = await (await browser.newContext()).newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill('main input[name="phone"]', phone);
  await page.fill('main input[name="password"]', password);
  await page.click('main button[type="submit"]');
  await page.waitForURL(landing, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  return page;
}
try {
  const member = await login("9000000103", "demo12345", /dashboard/);
  const admin = await login("9000000000", "admin12345", /admin/);
  await admin.goto(`${BASE}/admin/settings`);
  const panel = admin.locator("div", { hasText: "Emergency: sign out everyone" }).last();
  await panel.locator('button:has-text("Sign out everyone")').click();
  check("Confirmation phrase required", await admin.getByText("Type SIGN OUT EVERYONE to confirm.").waitFor({ timeout: 15000 }).then(() => true, () => false));
  await panel.locator('input[name="confirm"]').fill("SIGN OUT EVERYONE");
  await panel.locator('button:has-text("Sign out everyone")').click();
  const msg = admin.getByText(/Signed out [\d,]+ accounts/);
  check("Admin sees how many accounts were signed out", await msg.waitFor({ timeout: 15000 }).then(() => true, () => false), await msg.innerText().catch(() => ""));
  await member.goto(`${BASE}/dashboard`);
  await member.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check("Member is signed out", /\/login/.test(member.url()), member.url());
  await admin.goto(`${BASE}/admin`);
  await admin.waitForLoadState("networkidle");
  check("Acting admin stays signed in", /\/admin$/.test(admin.url()), admin.url());
  await admin.goto(`${BASE}/admin/activity`);
  check("Action recorded in the activity log", await admin.getByText("Signed out every account").first().isVisible());
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
