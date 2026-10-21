import { notFound } from "next/navigation";
import { cancelCampaign, deleteCampaign, sendTestCampaign, startCampaign, updateCampaign } from "@/app/actions/admin-campaigns";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, Panel, StatCard, label, statusTone } from "@/components/admin/ui";
import { type Audience, audienceWhere, fillParams, isTemplate } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { TEMPLATES, emailCopy } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { CampaignForm } from "../CampaignForm";

export const metadata = { title: "Campaign" };

const SEGMENT: Record<string, string> = { all: "Everyone", premium: "Premium members", free: "Free members" };

function describe(a: Audience): string {
  const parts = [SEGMENT[a.segment ?? "all"]];
  if (a.gender) parts.push(a.gender === "FEMALE" ? "brides" : "grooms");
  if (a.status === "NONE") parts.push("all accounts");
  else if (a.status && a.status !== "ANY") parts.push(`profile ${label(a.status).toLowerCase()}`);
  if (a.city) parts.push(`in ${a.city}`);
  if (a.inactiveDays) parts.push(`inactive ${a.inactiveDays}+ days`);
  if (a.joinedAfter) parts.push(`joined from ${a.joinedAfter}`);
  if (a.joinedBefore) parts.push(`joined until ${a.joinedBefore}`);
  return parts.join(" · ");
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c || !isTemplate(c.template)) notFound();
  const audience = c.audience as Audience;
  const campaignParams = c.params as Record<string, string>;
  const draft = c.status === "DRAFT";

  const [recipients, counts] = await Promise.all([
    draft ? db.user.count({ where: audienceWhere(audience, c.channel) }) : Promise.resolve(c.totalRecipients),
    db.notification.groupBy({ by: ["status"], where: { campaignId: id }, _count: true }),
  ]);
  const n = Object.fromEntries(counts.map((x) => [x.status, x._count])) as Record<string, number>;
  const sample = "Priya";
  const ordered = fillParams(c.template, campaignParams, sample, c.channel);
  const named = Object.fromEntries(TEMPLATES[c.template].map((k, i) => [k, ordered[i]]));
  const copy = emailCopy(c.template, named);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[["/admin/campaigns", "Campaigns"], [`/admin/campaigns/${id}`, c.name]]}
        title={c.name}
        description={<>{c.channel === "EMAIL" ? "Email" : "WhatsApp"} · {c.template.replaceAll("_", " ")} · created {dateTime(c.createdAt)}</>}
        actions={<Badge tone={c.status === "SENDING" ? "blue" : statusTone(c.status)}>{label(c.status)}</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={draft ? "Would reach" : "Recipients"} value={recipients.toLocaleString("en-IN")} hint={describe(audience)} tone={draft && recipients ? "attention" : "neutral"} />
        <StatCard label="Sent" value={(n.SENT ?? 0).toLocaleString("en-IN")} />
        <StatCard label="Waiting" value={(n.PENDING ?? 0).toLocaleString("en-IN")} hint={c.status === "SENDING" ? "Sent in batches every 10 minutes" : undefined} />
        <StatCard label="Not delivered" value={((n.FAILED ?? 0) + (n.NOT_CONFIGURED ?? 0)).toLocaleString("en-IN")} hint={n.NOT_CONFIGURED ? `${n.NOT_CONFIGURED} because the channel isn't connected` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Preview" description={`As “${sample}” would receive it. Each member sees their own first name.`}>
          {c.channel === "EMAIL" ? (
            <div className="rounded-lg border border-hairline bg-cream/40 p-4 text-sm">
              <p className="text-xs text-stone-500">Subject: <span className="text-ink">{copy.subject}</span></p>
              <p className="mt-3 font-semibold text-maroon">{copy.heading}</p>
              {copy.lines.map((l, i) => <p key={i} className="mt-2 whitespace-pre-line text-stone-700">{l}</p>)}
              {copy.cta && named.link && <p className="mt-3 inline-block rounded-full bg-maroon px-4 py-1.5 text-xs text-white">{copy.cta}</p>}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-stone-600">WhatsApp sends the Meta template <code className="rounded bg-sand px-1">{c.template}</code> with these variables:</p>
              <ol className="list-decimal space-y-1 pl-5">
                {TEMPLATES[c.template].map((k, i) => (
                  <li key={k}><span className="text-stone-500">{k}:</span> {ordered[i] || <em className="text-stone-400">empty</em>}</li>
                ))}
              </ol>
            </div>
          )}
        </Panel>

        <Panel title="Send">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-3">
              <ActionButton action={sendTestCampaign.bind(null, id)} pendingLabel="Sending test…">Send test to me</ActionButton>
              {draft && (
                <ActionButton
                  action={startCampaign.bind(null, id)}
                  variant="primary"
                  pendingLabel="Queuing…"
                  confirm={`Send this ${c.channel === "EMAIL" ? "email" : "WhatsApp message"} to ${recipients.toLocaleString("en-IN")} members? This cannot be undone.`}
                >
                  Start sending
                </ActionButton>
              )}
              {(draft || c.status === "SENDING") && (
                <ActionButton action={cancelCampaign.bind(null, id)} variant="danger" confirm="Cancel this campaign? Unsent messages will not be sent.">
                  Cancel campaign
                </ActionButton>
              )}
              {draft && (
                <ActionButton action={deleteCampaign.bind(null, id)} variant="ghost" confirm="Delete this draft?">Delete draft</ActionButton>
              )}
            </div>
            <ul className="space-y-1 text-xs text-stone-500">
              {c.startedAt && <li>Started {dateTime(c.startedAt)}</li>}
              {c.finishedAt && <li>Finished {dateTime(c.finishedAt)}</li>}
              <li>At most 3 campaigns can be started per day. Members who have not opted in never receive campaigns.</li>
            </ul>
          </div>
        </Panel>
      </div>

      {draft && (
        <Panel title="Edit draft">
          <CampaignForm
            action={updateCampaign.bind(null, id)}
            defaults={{ name: c.name, channel: c.channel, template: c.template, params: campaignParams, audience }}
            submitLabel="Save draft"
          />
        </Panel>
      )}
    </div>
  );
}
