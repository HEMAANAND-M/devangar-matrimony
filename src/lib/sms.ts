import "server-only";

/**
 * Sends one-time codes by SMS. The provider is chosen with SMS_PROVIDER:
 *   msg91        MSG91 Flow API (MSG91_AUTH_KEY, MSG91_TEMPLATE_ID; the template's variable is "otp")
 *   twilio       Twilio Messages API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)
 *   console      prints the code to the server log; refused in production unless ALLOW_CONSOLE_SMS=true
 *   console-test same as console, allowed anywhere (automated tests)
 */
const TIMEOUT_MS = 10_000;

export class SmsError extends Error {}

async function msg91(phone: string, code: string) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authkey || !templateId) throw new SmsError("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set");
  const res = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: { authkey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ template_id: templateId, short_url: "0", recipients: [{ mobiles: phone.replace(/^\+/, ""), otp: code }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  // MSG91 answers 200 with {"type":"error"} for many failures.
  if (!res.ok || /"type"\s*:\s*"error"/.test(body)) throw new SmsError(`MSG91 ${res.status}: ${body.slice(0, 200)}`);
}

async function twilio(phone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new SmsError("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM must be set");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phone,
      From: from,
      Body: `${code} is your Devangar Matrimony verification code. It expires in 10 minutes. Do not share it with anyone.`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new SmsError(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "console");
  switch (provider) {
    case "msg91":
      return msg91(phone, code);
    case "twilio":
      return twilio(phone, code);
    case "console":
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_SMS !== "true") {
        throw new SmsError("SMS_PROVIDER=console is not allowed in production (set ALLOW_CONSOLE_SMS=true for demos)");
      }
      console.log(`[OTP] ${phone}: ${code}`);
      return;
    case "console-test":
      console.log(`[OTP] ${phone}: ${code}`);
      return;
    default:
      throw new SmsError("No SMS provider configured (set SMS_PROVIDER)");
  }
}
