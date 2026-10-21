import Link from "next/link";
import { createCampaign } from "@/app/actions/admin-campaigns";
import { AdminPageHeader, Badge, EmptyState, Panel, Table, Td, label, statusTone } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { whatsappConfigured } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { CampaignForm } from "./CampaignForm";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requireAdmin();
  const [campaigns, counts] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.groupBy({ by: ["campaignId", "status"], where: { campaignId: { not: null } }, _count: true }),
  ]);
  const byCampaign = new Map<string, Record<string, number>>();
  for (const c of counts) {
    const row = byCampaign.get(c.campaignId!) ?? {};
    row[c.status] = c._count;
    byCampaign.set(c.campaignId!, row);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Campaigns"
        description={
          <>
            Send one WhatsApp or email message to a group of opted-in members. Messages go out in batches every 10 minutes.
            {!whatsappConfigured() && " WhatsApp is not connected yet, so WhatsApp campaigns will be recorded but not delivered."}
            {!emailConfigured() && " Email is not connected yet."}
          </>
        }
      />

      <Panel title="All campaigns" flush>
        {campaigns.length ? (
          <Table head={["Campaign", "Channel", "Status", "Recipients", "Sent", "Failed", "Waiting", "Created"]}>
            {campaigns.map((c) => {
              const n = byCampaign.get(c.id) ?? {};
              return (
                <tr key={c.id} className="hover:bg-cream/40">
                  <Td>
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-maroon hover:underline">{c.name}</Link>
                    <p className="text-xs text-stone-500">{c.template.replaceAll("_", " ")}</p>
                  </Td>
                  <Td>{c.channel === "EMAIL" ? "Email" : "WhatsApp"}</Td>
                  <Td><Badge tone={c.status === "SENDING" ? "blue" : statusTone(c.status)}>{label(c.status)}</Badge></Td>
                  <Td className="tabular-nums">{c.totalRecipients.toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums">{(n.SENT ?? 0).toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums">{((n.FAILED ?? 0) + (n.NOT_CONFIGURED ?? 0)).toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums">{(n.PENDING ?? 0).toLocaleString("en-IN")}</Td>
                  <Td className="whitespace-nowrap text-stone-600">{dateTime(c.createdAt)}</Td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState title="No campaigns yet">Create one below. It is saved as a draft until you start it.</EmptyState>
        )}
      </Panel>

      <Panel title="New campaign" description="Saved as a draft. You'll see how many members it reaches and a preview before anything is sent.">
        <CampaignForm action={createCampaign} submitLabel="Save draft" />
      </Panel>
    </div>
  );
}
