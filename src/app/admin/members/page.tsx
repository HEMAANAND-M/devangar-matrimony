import Link from "next/link";
import { bulkApprove } from "@/app/actions/admin-members";
import {
  AdminPageHeader, Badge, EmptyState, FilterBar, FilterField, Pagination, Panel, Table, Td, buttonCls, inputCls, label, selectCls, statusTone,
} from "@/components/admin/ui";
import { db } from "@/lib/db";
import { ageFrom, dateOnly, maskPhone } from "@/lib/format";
import { isPremium } from "@/lib/premium";
import { requireStaff } from "@/lib/session";
import { BulkForm } from "./BulkForm";
import { type MemberParams, memberSelect, memberWhere } from "./query";

export const metadata = { title: "Members" };
const PER_PAGE = 30;

function relative(d: Date | null): string {
  if (!d) return "Never";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 5) return "Online now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.floor(mins / 60)} h ago`;
  return `${Math.floor(mins / 1440)} days ago`;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<MemberParams> }) {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = memberWhere(params);
  const [members, total] = await Promise.all([
    db.user.findMany({ where, select: memberSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.user.count({ where }),
  ]);
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (k === "page" || !v ? [] : [[k, String(v)]])));
  const v = (k: string) => String(params[k] ?? "");

  return (
    <div>
      <AdminPageHeader
        title="Members"
        description={`${total.toLocaleString("en-IN")} member account${total === 1 ? "" : "s"} match.`}
        actions={isAdmin && <a href={`/api/admin/export/members?${query}`} className={buttonCls.secondary}>Export CSV</a>}
      />
      {params.erased && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">The account was erased. Its payment records were kept, unlinked.</p>
      )}
      <Panel flush>
        <FilterBar resetHref="/admin/members">
          <FilterField label="Search">
            <input name="q" defaultValue={v("q")} placeholder="Name, DM code, phone or city" className={`${inputCls} w-64`} />
          </FilterField>
          <FilterField label="Profile">
            <select name="status" defaultValue={v("status")} className={selectCls}>
              <option value="">Any</option>
              {["PENDING", "APPROVED", "REJECTED", "HIDDEN", "MARRIED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              <option value="NONE">No profile yet</option>
            </select>
          </FilterField>
          <FilterField label="Account">
            <select name="account" defaultValue={v("account")} className={selectCls}>
              <option value="">Any</option>
              {["ACTIVE", "SUSPENDED", "BANNED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Gender">
            <select name="gender" defaultValue={v("gender")} className={selectCls}>
              <option value="">Any</option><option value="FEMALE">Bride</option><option value="MALE">Groom</option>
            </select>
          </FilterField>
          <FilterField label="Premium">
            <select name="premium" defaultValue={v("premium")} className={selectCls}>
              <option value="">Any</option><option value="yes">Premium</option><option value="no">Free</option>
            </select>
          </FilterField>
          <FilterField label="ID verified">
            <select name="verified" defaultValue={v("verified")} className={selectCls}>
              <option value="">Any</option><option value="yes">Verified</option><option value="no">Not verified</option>
            </select>
          </FilterField>
          <FilterField label="Flags">
            <select name="flagged" defaultValue={v("flagged")} className={selectCls}>
              <option value="">Any</option><option value="yes">Flagged</option>
            </select>
          </FilterField>
          <FilterField label="Joined from"><input type="date" name="from" defaultValue={v("from")} className={inputCls} /></FilterField>
          <FilterField label="to"><input type="date" name="to" defaultValue={v("to")} className={inputCls} /></FilterField>
        </FilterBar>
        {members.length ? (
          <BulkForm action={bulkApprove}>
            <Table
              head={[
                <input key="all" type="checkbox" name="all" aria-label="Select all on this page" className="accent-maroon" />,
                "Member", "Status", "Details", "Membership", "Joined", "Last active",
              ]}
            >
              {members.map((m) => {
                const p = m.profile;
                return (
                  <tr key={m.id} className="hover:bg-cream/40">
                    <Td><input type="checkbox" name="ids" value={m.id} aria-label={`Select ${p?.name ?? "account"}`} className="accent-maroon" /></Td>
                    <Td>
                      <Link href={`/admin/members/${m.id}`} className="font-medium text-ink hover:text-maroon hover:underline">
                        {p?.name ?? (m.managing ? `Family manager · ${m.managing.profile.code}` : "No profile yet")}
                      </Link>
                      <p className="text-xs text-stone-500">{p?.code ? `${p.code} · ` : ""}{maskPhone(m.phone)}</p>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {p && <Badge tone={statusTone(p.status)}>{label(p.status)}</Badge>}
                        {m.status !== "ACTIVE" && <Badge tone="red">{label(m.status)}</Badge>}
                        {!m.phoneVerified && <Badge tone="amber">Phone unverified</Badge>}
                        {!!p?.flags.length && <Badge tone="red">⚑ {p.flags.length} flag{p.flags.length === 1 ? "" : "s"}</Badge>}
                      </span>
                    </Td>
                    <Td className="text-stone-600">
                      {p ? `${p.gender === "FEMALE" ? "Bride" : "Groom"} · ${ageFrom(p.dateOfBirth)} · ${p.city}` : "—"}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {isPremium(p) ? <Badge tone="gold">Premium</Badge> : <span className="text-xs text-stone-500">Free</span>}
                        {p?.idVerifiedAt && <Badge tone="blue">ID ✓</Badge>}
                        {p?.photoVerifiedAt && <Badge tone="blue">Photo ✓</Badge>}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-stone-600">{dateOnly(m.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-stone-600">{relative(m.lastActiveAt ?? m.lastLoginAt)}</Td>
                  </tr>
                );
              })}
            </Table>
          </BulkForm>
        ) : (
          <EmptyState title="No members match">Try a shorter search, or clear the filters.</EmptyState>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} params={params} basePath="/admin/members" />
      </Panel>
    </div>
  );
}
