// Agent E checks: chat, contact requests, email prefs, referrals. Needs chat-setup.ts "setup" first.
import { launch } from "./browser.mjs";

const BASE = process.argv[2] ?? "http://localhost:3105";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  â€” ${detail}` : ""}`);
};
const browser = await launch();

async function session(phone) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', "demo12345");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  return { ctx, page };
}

try {
  const a = await session("9000000104"); // DM90005 premium
  const b = await session("9000000100"); // DM90001

  // 1. Conversation list
  await a.page.goto(`${BASE}/messages`);
  const listText = await a.page.locator("main").innerText();
  check("A sees conversation with DM90001", /DM90001/.test(listText), listText.slice(0, 200).replace(/\s+/g, " "));
  await a.page.locator("main a[href^='/messages/']", { hasText: "DM90001" }).click();
  await a.page.waitForURL(/\/messages\/c/);
  const threadUrl = a.page.url();
  check("Composer visible for premium pair", await a.page.locator("#chat-draft").isVisible());

  // 2. Send
  await a.page.fill("#chat-draft", "Namaste! Lovely to connect with your family.");
  await a.page.keyboard.press("Enter");
  await a.page.locator("text=Namaste! Lovely to connect").waitFor();
  check("Sent message appears in thread", true);

  // 3. Contact info blocked
  await a.page.fill("#chat-draft", "Please call me on 98765 43210");
  await a.page.click("form:has(#chat-draft) button[type=submit]");
  const alert = a.page.locator("form [role=alert]");
  await alert.waitFor();
  check("Phone number in chat is blocked", /phone numbers/.test(await alert.innerText()), await alert.innerText());

  // 4. B sees unread then reads
  await b.page.goto(`${BASE}/messages`);
  const bRow = b.page.locator("main a[href^='/messages/']", { hasText: "DM90005" });
  check("B sees unread badge", /\b1\b/.test(await bRow.innerText()), (await bRow.innerText()).replace(/\s+/g, " "));
  await bRow.click();
  await b.page.locator("text=Namaste! Lovely to connect").waitFor();
  check("B sees A's message", true);

  // 5. Read receipt reaches A by polling
  await a.page.locator("[aria-label=Read]").first().waitFor({ timeout: 45000 }).then(() => check("A sees read receipt without reload", true), () => check("A sees read receipt without reload", false));

  // 6. B replies, A receives by polling
  await b.page.fill("#chat-draft", "Thank you! Happy to talk.");
  await b.page.click("form:has(#chat-draft) button[type=submit]");
  await b.page.locator("text=Thank you! Happy to talk.").waitFor();
  await a.page.locator("text=Thank you! Happy to talk.").waitFor({ timeout: 45000 }).then(() => check("A receives reply by polling", true), () => check("A receives reply by polling", false));
  // 6b. Scam language: delivered, recipient sees a safety tip
  await b.page.fill("#chat-draft", "Can you transfer some money to my bank account for an emergency?");
  await b.page.click("form:has(#chat-draft) button[type=submit]");
  await b.page.locator("text=transfer some money").waitFor();
  await a.page.locator("text=transfer some money").waitFor({ timeout: 45000 });
  await a.page.reload();
  check("Recipient sees a safety tip under a money request", await a.page.getByText("Safety tip: never send money").isVisible());
  check("Sender does not see the safety tip on their own message", (await b.page.getByText("Safety tip: never send money").count()) === 0);
  check("Thread URL is for interest",/\/messages\/c[a-z0-9]+$/.test(threadUrl), threadUrl);

  // 7. API auth
  const anon = await browser.newContext();
  const r = await anon.request.get(`${BASE}/api/messages/${threadUrl.split("/").pop()}`);
  check("Messages API rejects signed-out", r.status() === 401, String(r.status()));
  const r2 = await a.ctx.request.get(`${BASE}/api/messages/doesnotexist`);
  check("Messages API 404 for foreign/unknown", r2.status() === 404, String(r2.status()));
  const r3 = await a.ctx.request.get(`${BASE}/api/messages/${threadUrl.split("/").pop()}`);
  const j = await r3.json();
  check("Messages API returns messages", Array.isArray(j.messages) && j.messages.length === 3 && r3.headers()["cache-control"] === "no-store", `${j.messages?.length} ${r3.headers()["cache-control"]}`);
  await anon.close();

  // 8. Free pair: premium gate
  const c = await session("9000000103"); // DM90004 free, accepted with DM90002 (free)
  await c.page.goto(`${BASE}/messages`);
  check("Free pair sees upgrade banner", await c.page.locator("text=Messaging opens when at least one of you is a Premium member").isVisible());
  await c.page.locator("main a[href^='/messages/']", { hasText: "DM90002" }).click();
  await c.page.waitForURL(/\/messages\/c/);
  check("Free pair thread shows premium notice, no composer", (await c.page.locator("text=at least one of you to be a Premium member").count()) > 0 && (await c.page.locator("#chat-draft").count()) === 0);
  await c.page.goto(threadUrl);
  check("Other members cannot open someone else's thread", /could not be found|doesnâ€™t exist|404/i.test(await c.page.locator("body").innerText()));

  // 9. Contact request flow on the real pages
  await a.page.goto(`${BASE}/profiles/DM90001`);
  check("Connected premium member does not see the number before approval", (await a.page.locator("a[href='tel:+919000000100']").count()) === 0);
  check("MessageButton links to thread", (await a.page.locator(`main a[href='${new URL(threadUrl).pathname}']`).count()) === 1);
  await a.page.locator("main button", { hasText: "Request phone number" }).click();
  await a.page.getByText("Phone number requested").waitFor({ timeout: 20000 });
  check("Request pending state", true);
  await b.page.goto(`${BASE}/interests`);
  const inbox = b.page.locator("section", { hasText: "Phone number requests" });
  check("B inbox lists request", await inbox.locator("li", { hasText: "DM90005" }).isVisible());
  await inbox.locator("button", { hasText: "Share my number" }).click();
  await b.page.waitForLoadState("networkidle");
  await b.page.waitForTimeout(1500);
  await a.page.reload();
  check("A sees approved phone number", await a.page.locator("main a[href='tel:+919000000100']").isVisible());
  // after approval, sharing a number in chat is allowed
  await a.page.goto(threadUrl);
  await a.page.fill("#chat-draft", "My number is 98765 43210");
  await a.page.click("form:has(#chat-draft) button[type=submit]");
  await a.page.locator("text=My number is 98765 43210").waitFor({ timeout: 10000 }).then(() => check("Contact info allowed after approval", true), () => check("Contact info allowed after approval", false));

  // Free member sees upgrade CTA in contact panel
  await c.page.goto(`${BASE}/profiles/DM90002`);
  check("Free member sees upgrade CTA for phone", await c.page.locator("main", { hasText: "Upgrade to request phone number" }).isVisible());
  check("Free pair MessageButton shows upgrade", await c.page.locator("main a[href='/upgrade']", { hasText: "Upgrade to message" }).isVisible());

  // 10. Email prefs (settings page)
  await a.page.goto(`${BASE}/settings`);
  const prefs = a.page.locator("section", { hasText: "Email updates" });
  await prefs.locator("input[name=email]").fill("not-an-email");
  await prefs.locator("button", { hasText: "Save email" }).click();
  await a.page.waitForTimeout(1500);
  // browser validation may block type=email submission; either way nothing is saved
  check("Invalid email not saved", (await prefs.locator("text=Off for").count()) === 0);
  await prefs.locator("input[name=email]").fill("Demo.Five@Example.com");
  await prefs.locator("button", { hasText: "Save email" }).click();
  await prefs.getByText("Off for demo.five@example.com").waitFor({ timeout: 20000 });
  check("Email saved lower-cased", true);
  await prefs.locator("button", { hasText: "Turn on email updates" }).click();
  await prefs.getByText("On for demo.five@example.com").waitFor({ timeout: 20000 });
  check("Email opt-in toggles on", true);
  await b.page.goto(`${BASE}/settings`);
  const bPrefs = b.page.locator("section", { hasText: "Email updates" });
  await bPrefs.locator("input[name=email]").fill("demo.five@example.com");
  await bPrefs.locator("button", { hasText: "Save email" }).click();
  const dup = bPrefs.locator("[role=alert]");
  await dup.waitFor({ timeout: 20000 });
  check("Duplicate email rejected", /already used/.test(await dup.innerText()));

  // 11. Referral (settings page)
  const referral = a.page.locator("section", { hasText: "Invite families you know" });
  const code = (await referral.locator(".font-mono").innerText()).trim();
  check("Referral code is 8 unambiguous chars", /^[A-HJKMNP-Z2-9]{8}$/.test(code), code);
  check("Referral link shown", await referral.getByText(`/register?ref=${code}`).isVisible());
  await a.page.reload();
  check("Referral code stable", (await a.page.locator("section", { hasText: "Invite families you know" }).locator(".font-mono").innerText()).trim() === code);
  const wa = await a.page.locator("section", { hasText: "Invite families you know" }).locator("a[href^='https://wa.me/?text=']").getAttribute("href");
  check("WhatsApp share link contains referral", decodeURIComponent(wa ?? "").includes(code));

  // 12. Mobile layout: no horizontal overflow on thread
  await a.page.goto(threadUrl);
  const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("Thread has no horizontal scroll at 420px", overflow <= 0, String(overflow));
} catch (e) {
  check("Run completed", false, e.message.split("\n")[0]);
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

