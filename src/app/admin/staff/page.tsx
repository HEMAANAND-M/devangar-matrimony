import Link from "next/link";
import { addModerator, demoteAdmin, promoteToAdmin, removeModerator } from "@/app/actions/admin-staff";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, Panel, Table, Td, inputCls, label } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime, maskPhone } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const admin = await requireAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [staff, actionCounts] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["ADMIN", "MODERATOR"] } },
      select: { id: true, phone: true, role: true, lastLoginAt: true, lastActiveAt: true, createdAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.adminLog.groupBy({ by: ["adminId"], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  const counts = new Map(actionCounts.map((c) => [c.adminId, c._count]));
  const adminCount = staff.filter((s) => s.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Staff" description="Admins manage everything. Moderators review profiles, photos, reports and selfie checks, without access to payments, ID documents, phone numbers or staff." />
      <Panel title={`Team (${staff.length})`} flush>
        <Table head={["Account", "Role", "Last sign-in", "Actions · 30 days", ""]}>
          {staff.map((s) => (
            <tr key={s.id}>
              <Td>
                <span className="font-medium text-ink">{maskPhone(s.phone)}</span>
                {s.id === admin.id && <span className="ml-2 text-xs text-stone-500">(you)</span>}
              </Td>
              <Td><Badge tone={s.role === "ADMIN" ? "maroon" : "neutral"}>{label(s.role)}</Badge></Td>
              <Td className="whitespace-nowrap text-stone-600">{s.lastLoginAt ? dateTime(s.lastLoginAt) : "Never"}</Td>
              <Td className="tabular-nums">
                <Link href={`/admin/activity?staff=${s.id}`} className="text-maroon hover:underline">{counts.get(s.id) ?? 0}</Link>
              </Td>
              <Td>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  {s.role === "MODERATOR" && (
                    <>
                      <ActionForm action={promoteToAdmin.bind(null, s.id)} className="flex items-start gap-2" confirm="Give this moderator full admin access, including payments and ID documents?">
                        <input name="confirm" placeholder="Type PROMOTE" aria-label="Type PROMOTE to confirm" autoComplete="off" className={`${inputCls} w-32 !py-1.5`} />
                        <SubmitButton variant="secondary" className="!rounded-lg !px-3 !py-1.5">Make admin</SubmitButton>
                      </ActionForm>
                      <ActionButton action={removeModerator.bind(null, s.id)} variant="danger" confirm="Remove moderator access?" className="!py-1.5">Remove</ActionButton>
                    </>
                  )}
                  {s.role === "ADMIN" && s.id !== admin.id && adminCount > 1 && (
                    <ActionButton action={demoteAdmin.bind(null, s.id)} variant="danger" confirm="Change this admin to a moderator?" className="!py-1.5">Make moderator</ActionButton>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Add a moderator" description="They must already have a verified member account. Their member profile, if any, stays as it is.">
        <ActionForm action={addModerator} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Mobile number
            <input name="phone" type="tel" inputMode="numeric" required placeholder="98765 43210" className={`${inputCls} w-56`} />
          </label>
          <SubmitButton className="!rounded-lg !px-4 !py-2">Add moderator</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
