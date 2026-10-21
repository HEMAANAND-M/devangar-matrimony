import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { inputCls, selectCls } from "@/components/admin/ui";
import { BULK_TEMPLATES, type Audience } from "@/lib/campaigns";
import type { FormState } from "@/lib/form";
import { TEMPLATES } from "@/lib/notify";
import { TemplateFields } from "./TemplateFields";

export type CampaignDefaults = {
  name?: string;
  channel?: string;
  template?: string;
  params?: Record<string, string>;
  audience?: Audience;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-stone-600">
    {label}
    <span className="mt-1 block">{children}</span>
  </label>
);

export function CampaignForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  defaults?: CampaignDefaults;
  submitLabel: string;
}) {
  const a = defaults.audience ?? {};
  const templates = Object.fromEntries(BULK_TEMPLATES.map((t) => [t, TEMPLATES[t]]));
  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Campaign name (for staff only)">
          <input name="name" defaultValue={defaults.name ?? ""} required maxLength={120} placeholder="e.g. Pongal offer to free members" className={`${inputCls} w-full`} />
        </Field>
        <Field label="Channel">
          <select name="channel" defaultValue={defaults.channel ?? "WHATSAPP"} className={`${selectCls} w-full`}>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </Field>
        <TemplateFields templates={templates} initialTemplate={defaults.template ?? "announcement"} initialParams={defaults.params ?? {}} />
      </div>
      <div className="space-y-4">
        <p className="text-sm font-medium text-ink">Audience</p>
        <p className="-mt-3 text-xs text-stone-500">Only members who opted in to the channel are included, and never suspended or banned accounts.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Membership">
            <select name="segment" defaultValue={a.segment ?? "all"} className={`${selectCls} w-full`}>
              <option value="all">Everyone</option>
              <option value="premium">Premium members</option>
              <option value="free">Free members</option>
            </select>
          </Field>
          <Field label="Gender">
            <select name="gender" defaultValue={a.gender ?? ""} className={`${selectCls} w-full`}>
              <option value="">Brides and grooms</option>
              <option value="FEMALE">Brides</option>
              <option value="MALE">Grooms</option>
            </select>
          </Field>
          <Field label="Profile status">
            <select name="status" defaultValue={a.status ?? "APPROVED"} className={`${selectCls} w-full`}>
              <option value="APPROVED">Live (approved)</option>
              <option value="PENDING">Waiting for review</option>
              <option value="HIDDEN">Hidden</option>
              <option value="REJECTED">Needs changes</option>
              <option value="MARRIED">Married</option>
              <option value="ANY">Any profile</option>
              <option value="NONE">All accounts, even without a profile</option>
            </select>
          </Field>
          <Field label="City">
            <input name="city" defaultValue={a.city ?? ""} maxLength={60} placeholder="Any city" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Inactive for at least (days)">
            <input name="inactiveDays" type="number" min={1} max={3650} defaultValue={a.inactiveDays ?? ""} placeholder="Any" className={`${inputCls} w-full`} />
          </Field>
          <span />
          <Field label="Joined on or after">
            <input name="joinedAfter" type="date" defaultValue={a.joinedAfter ?? ""} className={`${inputCls} w-full`} />
          </Field>
          <Field label="Joined on or before">
            <input name="joinedBefore" type="date" defaultValue={a.joinedBefore ?? ""} className={`${inputCls} w-full`} />
          </Field>
        </div>
        <div className="pt-2">
          <SubmitButton className="!rounded-lg !px-4 !py-2">{submitLabel}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
