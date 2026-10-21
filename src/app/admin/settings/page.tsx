import { saveFeatures, saveLists } from "@/app/actions/admin-content";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AdminPageHeader, Badge, Panel, inputCls } from "@/components/admin/ui";
import { getLists, type ListKey } from "@/lib/lists";
import { whatsappConfigured } from "@/lib/notify";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireAdmin } from "@/lib/session";
import { FEATURE_DEFAULTS, type Feature, featureEnabled } from "@/lib/settings";

export const metadata = { title: "Settings" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";

const LIST_LABELS: Record<ListKey, [string, string]> = {
  gothrams: ["Gothrams", "Shown in profile forms and the same-gothram filter."],
  subSects: ["Sub-sects", "Devangar sub-communities members can choose from."],
  cities: ["Cities", "Suggested cities for profiles and search."],
  education: ["Education", "Highest qualification options."],
  occupations: ["Occupations", "Profession options."],
};

const FEATURE_LABELS: Record<Feature, [string, string]> = {
  registrations: ["New registrations", "Allow new accounts to sign up."],
  payments: ["Online payments", "Premium checkout on the upgrade page."],
  whatsapp: ["WhatsApp notifications", "Send WhatsApp messages to opted-in members."],
  email: ["Email notifications", "Send email to members who added an address."],
  idVerification: ["ID verification", "Members can submit a government ID for review."],
  photoVerification: ["Selfie verification", "Members can submit a selfie to verify their photos."],
  chat: ["Chat", "In-app messages between members with an accepted interest."],
  contactRequests: ["Phone number requests", "Members can ask to see each other’s number."],
};

export default async function SettingsPage() {
  await requireAdmin();
  const lists = await getLists();
  const features = Object.fromEntries(
    await Promise.all((Object.keys(FEATURE_DEFAULTS) as Feature[]).map(async (k) => [k, await featureEnabled(k)] as const)),
  ) as Record<Feature, boolean>;

  const env = (name: string) => !!process.env[name];
  const integrations: [string, boolean, string][] = [
    ["Razorpay payments", razorpayConfigured(), "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET"],
    ["Razorpay webhook", env("RAZORPAY_WEBHOOK_SECRET"), "RAZORPAY_WEBHOOK_SECRET"],
    ["WhatsApp Cloud API", whatsappConfigured(), "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID"],
    ["SMS provider (OTP)", env("SMS_PROVIDER"), "SMS_PROVIDER and provider keys"],
    ["Email", env("RESEND_API_KEY") || env("SMTP_URL"), "RESEND_API_KEY and EMAIL_FROM"],
    ["Photo storage (Vercel Blob)", env("BLOB_READ_WRITE_TOKEN"), "BLOB_READ_WRITE_TOKEN — photos are stored in the database without it"],
    ["Scheduled jobs", env("CRON_SECRET"), "CRON_SECRET"],
    ["ID document key", env("ID_DOC_KEY"), "ID_DOC_KEY — falls back to a key derived from SESSION_SECRET"],
    ["GST invoice details", env("BUSINESS_GSTIN") && env("BUSINESS_NAME") && env("BUSINESS_ADDRESS"), "BUSINESS_NAME, BUSINESS_GSTIN, BUSINESS_ADDRESS"],
    ["Error monitoring", env("SENTRY_DSN"), "SENTRY_DSN"],
    ["Staff sign-in code (2FA)", process.env.STAFF_2FA !== "off", "STAFF_2FA — keep on in production"],
    ["Admin IP allowlist", env("ADMIN_IP_ALLOWLIST"), "ADMIN_IP_ALLOWLIST — staff powers only from listed office/VPN IPs"],
    ["Breached-password check", process.env.PWNED_PASSWORD_CHECK !== "off" && (process.env.NODE_ENV === "production" || process.env.PWNED_PASSWORD_CHECK === "on"), "PWNED_PASSWORD_CHECK — on by default in production"],
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Settings" description="Dropdown options, feature switches and integration status." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Feature switches" description="Turn features off instantly, for example during an incident. Changes apply on the next page load.">
          <ActionForm action={saveFeatures} className="space-y-1">
            {(Object.keys(FEATURE_DEFAULTS) as Feature[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-2 py-2.5 hover:bg-cream/60">
                <span>
                  <span className="block text-sm font-medium text-ink">{FEATURE_LABELS[k][0]}</span>
                  <span className="block text-xs text-stone-500">{FEATURE_LABELS[k][1]}</span>
                </span>
                <input type="checkbox" name={k} defaultChecked={features[k]} className="mt-1 h-4 w-4 shrink-0 accent-maroon" />
              </label>
            ))}
            <div className="pt-3"><SubmitButton className={SUBMIT}>Save switches</SubmitButton></div>
          </ActionForm>
        </Panel>

        <Panel title="Integrations" description="Configured through environment variables on the server.">
          <ul className="divide-y divide-hairline text-sm">
            {integrations.map(([name, ok, hint]) => (
              <li key={name} className="flex items-start justify-between gap-4 py-2.5">
                <span>
                  <span className="block font-medium text-ink">{name}</span>
                  <span className="block text-xs text-stone-500">{hint}</span>
                </span>
                <Badge tone={ok ? "green" : "amber"}>{ok ? "Configured" : "Not set"}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Dropdown lists" description="One option per line. Existing profiles keep their saved values even if an option is removed.">
        <ActionForm action={saveLists} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(LIST_LABELS) as ListKey[]).map((k) => (
              <label key={k} className="block text-xs font-medium text-stone-600">
                <span className="text-sm text-ink">{LIST_LABELS[k][0]}</span> <span className="font-normal text-stone-500">· {lists[k].length} options</span>
                <span className="block font-normal text-stone-500">{LIST_LABELS[k][1]}</span>
                <textarea name={k} rows={12} defaultValue={lists[k].join("\n")} className={`${inputCls} mt-2 w-full font-mono text-[0.8rem] leading-relaxed`} />
              </label>
            ))}
          </div>
          <SubmitButton className={SUBMIT}>Save lists</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
