import { createCoupon, deleteCoupon, savePlans, setCouponActive } from "@/app/actions/admin-business";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, EmptyState, Panel, Table, Td, inputCls, selectCls } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { getPlans } from "@/lib/plans";
import { rupees } from "@/lib/premium";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Plans & coupons" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";
const field = `${inputCls} w-full`;

export default async function CouponsPage() {
  await requireAdmin();
  const [plans, coupons] = await Promise.all([
    getPlans({ includeInactive: true }),
    db.coupon.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
  ]);
  // One blank row for adding a plan.
  const rows = [...plans, null];
  const now = new Date();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Plans & coupons" description="Prices are GST inclusive. Changes apply to new checkouts immediately; past payments keep the price paid." />

      <Panel title="Membership plans" description="Untick “Active” to stop selling a plan without losing its history.">
        <ActionForm action={savePlans} className="space-y-4">
          <input type="hidden" name="count" value={rows.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Name</th>
                  <th className="pb-2 pr-3 font-medium">Months</th>
                  <th className="pb-2 pr-3 font-medium">Price (₹)</th>
                  <th className="pb-2 pr-3 font-medium">Tagline</th>
                  <th className="pb-2 pr-3 font-medium">Featured</th>
                  <th className="pb-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p?.id ?? "new"} className="align-top">
                    <td className="py-1.5 pr-3">
                      <input type="hidden" name={`id_${i}`} value={p?.id ?? ""} />
                      <input name={`name_${i}`} defaultValue={p?.name} placeholder={p ? "" : "New plan name"} className={field} />
                    </td>
                    <td className="w-24 py-1.5 pr-3"><input name={`months_${i}`} type="number" min={1} max={36} defaultValue={p?.months} className={field} /></td>
                    <td className="w-32 py-1.5 pr-3"><input name={`price_${i}`} inputMode="decimal" defaultValue={p ? p.amount / 100 : ""} className={field} /></td>
                    <td className="py-1.5 pr-3"><input name={`tagline_${i}`} defaultValue={p?.tagline} className={field} /></td>
                    <td className="py-1.5 pr-3 pt-3.5"><input type="checkbox" name={`featured_${i}`} defaultChecked={!!p?.featured} className="h-4 w-4 accent-maroon" aria-label="Featured" /></td>
                    <td className="py-1.5 pt-3.5"><input type="checkbox" name={`active_${i}`} defaultChecked={p ? p.active !== false : true} className="h-4 w-4 accent-maroon" aria-label="Active" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-stone-500">Fill the last row to add a plan. Clear a name to retire a plan.</p>
            <SubmitButton className={SUBMIT}>Save plans</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="New coupon">
          <ActionForm action={createCoupon} className="space-y-3">
            <label className="block text-xs font-medium text-stone-600">
              Code
              <input name="code" required placeholder="FESTIVE20" className={`${field} mt-1 uppercase`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-stone-600">
                Type
                <select name="kind" className={`${selectCls} mt-1 w-full`}>
                  <option value="percent">% off</option>
                  <option value="amount">₹ off</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-stone-600">
                Value
                <input name="value" required inputMode="decimal" placeholder="20" className={`${field} mt-1`} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-stone-600">
                Max uses
                <input name="maxUses" type="number" min={1} placeholder="Unlimited" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                Expires on
                <input name="expiresAt" type="date" className={`${field} mt-1`} />
              </label>
            </div>
            <fieldset>
              <legend className="text-xs font-medium text-stone-600">Applies to (none ticked = all plans)</legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {plans.filter((p) => p.active !== false).map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm text-stone-700">
                    <input type="checkbox" name="plans" value={p.id} className="accent-maroon" /> {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton className={`${SUBMIT} w-full`}>Create coupon</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel flush title={`Coupons (${coupons.length})`}>
          {coupons.length ? (
            <Table head={["Code", "Discount", "Plans", "Used", "Expires", "Status", ""]}>
              {coupons.map((c) => {
                const expired = !!c.expiresAt && c.expiresAt < now;
                const exhausted = c.maxUses != null && c.uses >= c.maxUses;
                return (
                  <tr key={c.id}>
                    <Td className="font-mono font-medium">{c.code}</Td>
                    <Td>{c.percentOff ? `${c.percentOff}%` : rupees(c.amountOff ?? 0)}</Td>
                    <Td className="text-stone-600">{c.plans.length ? c.plans.map((id) => plans.find((p) => p.id === id)?.name ?? id).join(", ") : "All"}</Td>
                    <Td className="tabular-nums">{c.uses}{c.maxUses != null && ` / ${c.maxUses}`}</Td>
                    <Td className="whitespace-nowrap text-stone-600">{c.expiresAt ? dateOnly(c.expiresAt) : "Never"}</Td>
                    <Td>
                      {!c.active ? <Badge>Inactive</Badge> : expired ? <Badge tone="red">Expired</Badge> : exhausted ? <Badge tone="amber">Used up</Badge> : <Badge tone="green">Active</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        <ActionButton variant="ghost" action={setCouponActive.bind(null, c.id, !c.active)}>{c.active ? "Deactivate" : "Activate"}</ActionButton>
                        {c.uses === 0 && (
                          <ActionButton variant="ghost" confirm={`Delete coupon ${c.code}?`} action={deleteCoupon.bind(null, c.id)}>Delete</ActionButton>
                        )}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState title="No coupons yet">Create a code for festivals, community events or referral offers.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
