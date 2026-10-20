import Link from "next/link";
import { reviewVerification } from "@/app/actions/verification";
import { ApproveButton, RejectForm } from "@/app/admin/approvals/_components/moderation";
import { ID_REJECT_REASONS, SELFIE_REJECT_REASONS, Tabs, waited } from "@/app/admin/approvals/_components/shared";
import { AdminPageHeader, Badge, EmptyState, Panel, Table, Td, label, statusTone } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime, maskPhone, photoUrl } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Verifications" };

const reject = (id: string) => reviewVerification.bind(null, id, false);
const approve = (id: string) => reviewVerification.bind(null, id, true, "");

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const { tab: rawTab } = await searchParams;
  // Moderators only ever see selfie checks; ID documents are admin-only.
  const tab = isAdmin && rawTab === "ids" ? "ids" : "selfies";
  const isSelfies = tab === "selfies";

  const typeFilter = isSelfies ? { docType: "SELFIE" as const } : { docType: { not: "SELFIE" as const } };
  const [pending, recent, selfieCount, idCount] = await Promise.all([
    db.idVerification.findMany({
      where: { status: "PENDING", ...typeFilter },
      select: {
        id: true, docType: true, last4: true, documentMime: true, createdAt: true,
        profile: {
          select: {
            code: true, name: true, gender: true, city: true, userId: true,
            photos: { where: { approved: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true }, take: 4 },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.idVerification.findMany({
      where: { status: { not: "PENDING" }, ...typeFilter },
      select: { id: true, docType: true, last4: true, status: true, rejectionReason: true, reviewedAt: true, reviewedById: true, profile: { select: { code: true, name: true } } },
      orderBy: { reviewedAt: "desc" },
      take: 15,
    }),
    db.idVerification.count({ where: { status: "PENDING", docType: "SELFIE" } }),
    isAdmin ? db.idVerification.count({ where: { status: "PENDING", docType: { not: "SELFIE" } } }) : 0,
  ]);
  const reviewers = new Map(
    (await db.user.findMany({ where: { id: { in: recent.map((r) => r.reviewedById).filter((x): x is string => !!x) } }, select: { id: true, phone: true } })).map((u) => [u.id, u.phone]),
  );

  return (
    <div>
      <AdminPageHeader
        title="Verifications"
        description="Uploaded files are encrypted, decrypted only when opened here, and deleted the moment you approve or reject."
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "selfies", label: "Selfie checks", count: selfieCount, href: "/admin/verifications" },
          ...(isAdmin ? [{ key: "ids", label: "ID documents", count: idCount, href: "/admin/verifications?tab=ids" }] : []),
        ]}
      />

      <Panel
        flush
        title={isSelfies ? "Selfies awaiting review" : "Documents awaiting review"}
        description={isSelfies ? "Compare the selfie with the member's approved photos. Approval adds the “Photo verified” badge." : "Check the name matches the profile and only the last 4 digits are visible."}
      >
        {pending.length ? (
          <ul className="divide-y divide-hairline">
            {pending.map((v) => (
              <li key={v.id} className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-3">
                  <div className="text-sm">
                    <Link href={`/admin/members/${v.profile.userId}`} className="font-semibold text-ink hover:text-maroon">{v.profile.name} ({v.profile.code})</Link>
                    <p className="text-stone-500">
                      {label(v.profile.gender)} · {v.profile.city} · submitted {dateTime(v.createdAt)} ({waited(v.createdAt)} ago)
                    </p>
                  </div>
                  {isSelfies ? (
                    <div className="flex flex-wrap items-start gap-4">
                      <figure>
                        {/* eslint-disable-next-line @next/next/no-img-element -- decrypted by a staff-only route */}
                        <img src={`/api/admin/selfies/${v.id}`} alt="Selfie" className="h-52 w-44 rounded-lg border-2 border-gold object-cover" />
                        <figcaption className="mt-1 text-center text-xs font-medium text-gold-dark">Selfie</figcaption>
                      </figure>
                      <div className="flex flex-wrap gap-2">
                        {v.profile.photos.map((ph) => (
                          <figure key={ph.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
                            <img src={photoUrl(ph.id, "thumb")} alt="Profile photo" loading="lazy" className="h-52 w-40 rounded-lg border border-hairline object-cover" />
                            <figcaption className="mt-1 text-center text-xs text-stone-500">Profile photo</figcaption>
                          </figure>
                        ))}
                        {!v.profile.photos.length && <p className="text-sm italic text-stone-500">No approved photos to compare with.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Badge tone="blue">{label(v.docType)}</Badge>
                      <span>ending <strong className="tabular-nums">••{v.last4}</strong></span>
                      <a href={`/api/admin/id-documents/${v.id}`} target="_blank" rel="noopener noreferrer" className="text-maroon underline decoration-gold/50 underline-offset-4">
                        {v.documentMime === "application/pdf" ? "Download PDF" : "Open document ↗"}
                      </a>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <ApproveButton action={approve(v.id)} label={isSelfies ? "Approve — it's the same person" : "Approve document"} className="w-full" />
                  <RejectForm action={reject(v.id)} reasons={isSelfies ? SELFIE_REJECT_REASONS : ID_REJECT_REASONS} label="Reject" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="All caught up">{isSelfies ? "No selfies are waiting for review." : "No ID documents are waiting for review."}</EmptyState>
        )}
      </Panel>

      {recent.length > 0 && (
        <Panel flush title="Recent decisions" className="mt-5">
          <Table head={["Member", isSelfies ? "Check" : "Document", "Decision", "Reviewed"]}>
            {recent.map((r) => (
              <tr key={r.id}>
                <Td><span className="font-medium text-ink">{r.profile.name}</span> <span className="text-stone-500">({r.profile.code})</span></Td>
                <Td className="text-stone-600">{r.docType === "SELFIE" ? "Selfie" : `${label(r.docType)} ••${r.last4}`}</Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{label(r.status)}</Badge>
                  {r.rejectionReason && <p className="mt-1 text-xs text-stone-500">{r.rejectionReason}</p>}
                </Td>
                <Td className="text-stone-600">
                  {r.reviewedAt ? dateTime(r.reviewedAt) : "—"}
                  {r.reviewedById && reviewers.get(r.reviewedById) && <p className="text-xs text-stone-500">{maskPhone(reviewers.get(r.reviewedById)!)}</p>}
                </Td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
