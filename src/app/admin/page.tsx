import Link from "next/link";
import {
  addModerator, approvePhoto, approveProfile, rejectPhoto, rejectProfile, removeModerator, resolveReport,
} from "@/app/actions/admin";
import { reviewIdVerification } from "@/app/actions/verification";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { ageFrom, photoUrl } from "@/lib/format";
import { whatsappConfigured } from "@/lib/notify";
import { PLANS, rupees } from "@/lib/premium";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Admin" };

const when = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminPage() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";

  const [pendingProfiles, pendingPhotos, reports, stats] = await Promise.all([
    db.profile.findMany({ where: { status: "PENDING" }, include: { user: { select: { phone: true } } }, orderBy: { updatedAt: "asc" }, take: 50 }),
    db.photo.findMany({ where: { approved: false }, include: { profile: { select: { code: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }),
    db.report.findMany({ where: { resolved: false }, include: { reporter: true, target: true }, orderBy: { createdAt: "asc" } }),
    db.profile.groupBy({ by: ["status"], _count: true }),
  ]);

  // Admin-only data is not even queried for moderators.
  const admin = isAdmin
    ? await Promise.all([
        db.idVerification.findMany({
          where: { status: "PENDING" },
          select: { id: true, docType: true, last4: true, documentMime: true, createdAt: true, profile: { select: { code: true, name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        db.payment.findMany({ where: { status: "PAID" }, include: { profile: { select: { code: true, name: true } } }, orderBy: { paidAt: "desc" }, take: 15 }),
        db.payment.aggregate({ where: { status: "PAID", demo: false }, _sum: { amount: true }, _count: true }),
        db.profile.count({ where: { premiumUntil: { gt: new Date() } } }),
        db.user.findMany({ where: { role: { in: ["ADMIN", "MODERATOR"] } }, select: { id: true, phone: true, role: true }, orderBy: { role: "asc" } }),
        db.notification.findMany({ include: { user: { select: { phone: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
        db.adminLog.findMany({ include: { admin: { select: { phone: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
      ])
    : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={isAdmin ? "Administration" : "Moderator"} title={isAdmin ? "Admin" : "Moderation"} />
      <div className="-mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.status} className="rounded-2xl border border-hairline bg-white p-5 shadow-soft">
            <p className="eyebrow text-gold-dark">{s.status.toLowerCase()}</p>
            <p className="mt-1 font-display text-4xl font-semibold text-maroon">{s._count}</p>
          </div>
        ))}
      </div>

      <Card title={`Profiles awaiting review (${pendingProfiles.length})`}>
        <div className="divide-y divide-hairline">
          {pendingProfiles.map((p) => (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="text-sm">
                <Link href={`/profiles/${p.code}`} className="font-semibold text-maroon hover:underline">{p.name} ({p.code})</Link>
                <p className="text-stone-600">
                  {p.gender.toLowerCase()} · {ageFrom(p.dateOfBirth)} yrs · {p.city}
                  {isAdmin && ` · ${p.user.phone}`}
                </p>
                <p className="text-stone-600">{p.education} · {p.occupation} · gothram {p.gothram ?? "—"}</p>
                {p.about && <p className="mt-1 max-w-xl text-stone-700">{p.about}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <form action={approveProfile.bind(null, p.id)}>
                  <button className="rounded-full bg-emerald-700 px-4 py-1.5 text-sm text-white">Approve</button>
                </form>
                <ActionForm action={rejectProfile.bind(null, p.id)} className="flex gap-2">
                  <input name="reason" placeholder="Reason for rejection" className="rounded-lg border border-hairline px-3 py-1.5 text-sm" />
                  <SubmitButton variant="danger">Reject</SubmitButton>
                </ActionForm>
              </div>
            </div>
          ))}
          {!pendingProfiles.length && <p className="text-sm text-stone-600">All caught up.</p>}
        </div>
      </Card>

      <Card title={`Photos awaiting review (${pendingPhotos.length})`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {pendingPhotos.map((ph) => (
            <div key={ph.id} className="overflow-hidden rounded-md border border-hairline text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
              <img src={photoUrl(ph.id, "thumb")} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
              <p className="truncate px-2 pt-1">{ph.profile.name} ({ph.profile.code})</p>
              <div className="flex justify-between p-2">
                <form action={approvePhoto.bind(null, ph.id)}><button className="text-green-700 underline">Approve</button></form>
                <form action={rejectPhoto.bind(null, ph.id)}><button className="text-red-700 underline">Reject</button></form>
              </div>
            </div>
          ))}
        </div>
        {!pendingPhotos.length && <p className="text-sm text-stone-600">All caught up.</p>}
      </Card>

      <Card title={`Open reports (${reports.length})`}>
        <div className="divide-y divide-hairline">
          {reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-4 py-3 text-sm">
              <div>
                <p>
                  <Link href={`/profiles/${r.target.code}`} className="font-semibold text-maroon">{r.target.name} ({r.target.code})</Link>
                  <span className="text-stone-500"> reported by {r.reporter.code}</span>
                </p>
                <p className="mt-1 text-stone-700">{r.reason}</p>
              </div>
              <div className="flex gap-3">
                <form action={resolveReport.bind(null, r.id, false)}><button className="underline">Dismiss</button></form>
                <form action={resolveReport.bind(null, r.id, true)}><button className="text-red-700 underline">Remove profile</button></form>
              </div>
            </div>
          ))}
          {!reports.length && <p className="text-sm text-stone-600">No open reports.</p>}
        </div>
      </Card>

      {admin && (() => {
        const [ids, payments, revenue, premiumCount, staffList, notifications, activity] = admin;
        return (
          <>
            <Card title={`ID verifications (${ids.length})`}>
              <p className="mb-4 text-xs text-stone-500">Documents are decrypted only when opened and deleted the moment you approve or reject.</p>
              <div className="divide-y divide-hairline">
                {ids.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-start justify-between gap-4 py-4 text-sm">
                    <div>
                      <Link href={`/profiles/${v.profile.code}`} className="font-semibold text-maroon hover:underline">{v.profile.name} ({v.profile.code})</Link>
                      <p className="text-stone-600">{v.docType.replace("_", " ").toLowerCase()} ending ••{v.last4} · {when(v.createdAt)}</p>
                      <a href={`/api/admin/id-documents/${v.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-maroon underline decoration-gold/50 underline-offset-4">
                        {v.documentMime === "application/pdf" ? "Download PDF" : "View document"}
                      </a>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <ActionForm action={reviewIdVerification.bind(null, v.id, true)}>
                        <SubmitButton className="!bg-emerald-700 !px-4 !py-1.5">Approve</SubmitButton>
                      </ActionForm>
                      <ActionForm action={reviewIdVerification.bind(null, v.id, false)} className="flex gap-2">
                        <input name="reason" placeholder="Reason (e.g. blurry, name mismatch)" className="rounded-lg border border-hairline px-3 py-1.5 text-sm" />
                        <SubmitButton variant="danger">Reject</SubmitButton>
                      </ActionForm>
                    </div>
                  </div>
                ))}
                {!ids.length && <p className="text-sm text-stone-600">No documents awaiting review.</p>}
              </div>
            </Card>

            <Card title="Payments">
              <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-cream p-4">
                  <p className="eyebrow text-gold-dark">Revenue</p>
                  <p className="mt-1 font-display text-3xl font-semibold text-maroon">{rupees(revenue._sum.amount ?? 0)}</p>
                  <p className="text-xs text-stone-500">{revenue._count} paid orders (excl. demo)</p>
                </div>
                <div className="rounded-xl bg-cream p-4">
                  <p className="eyebrow text-gold-dark">Active premium</p>
                  <p className="mt-1 font-display text-3xl font-semibold text-maroon">{premiumCount}</p>
                </div>
                <div className="rounded-xl bg-cream p-4">
                  <p className="eyebrow text-gold-dark">Gateway</p>
                  <p className="mt-1 text-sm font-medium">{razorpayConfigured() ? "Razorpay live" : "Demo mode"}</p>
                </div>
              </div>
              <ul className="divide-y divide-hairline text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span>
                      {p.profile ? `${p.profile.name} (${p.profile.code})` : "Deleted account"} · {PLANS.find((x) => x.id === p.plan)?.name ?? p.plan}
                      {p.demo && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-xs text-stone-600">demo</span>}
                    </span>
                    <span className="text-stone-600">{rupees(p.amount)} · {p.paidAt && when(p.paidAt)}</span>
                  </li>
                ))}
                {!payments.length && <li className="py-2 text-stone-600">No payments yet.</li>}
              </ul>
            </Card>

            <Card title="Staff">
              <ul className="divide-y divide-hairline text-sm">
                {staffList.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <span>
                      {s.phone} <span className="ml-2 text-xs uppercase tracking-wider text-gold-dark">{s.role.toLowerCase()}</span>
                    </span>
                    {s.role === "MODERATOR" && (
                      <form action={removeModerator.bind(null, s.id)}><button className="text-red-700 hover:underline">Remove</button></form>
                    )}
                  </li>
                ))}
              </ul>
              <ActionForm action={addModerator} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <TextField label="Add moderator by mobile number" name="phone" type="tel" inputMode="numeric" required hint="They must already have a verified account." />
                <SubmitButton>Add moderator</SubmitButton>
              </ActionForm>
              <p className="mt-3 text-xs text-stone-500">Moderators can review profiles, photos and reports. They cannot see payments, ID documents, member phone numbers or staff.</p>
            </Card>

            <Card title="WhatsApp notifications">
              <p className="mb-3 text-xs text-stone-500">{whatsappConfigured() ? "WhatsApp Cloud API connected." : "Not connected — messages are recorded but not sent. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID."}</p>
              <ul className="divide-y divide-hairline text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {n.template.replace("_", " ")} → {n.user.phone}
                      {n.error && <span className="block text-xs text-red-700">{n.error}</span>}
                    </span>
                    <span className="text-xs text-stone-500">{n.status.toLowerCase().replace("_", " ")} · {when(n.createdAt)}</span>
                  </li>
                ))}
                {!notifications.length && <li className="py-2 text-stone-600">No notifications yet.</li>}
              </ul>
            </Card>

            <Card title="Recent moderation activity">
              {activity.length ? (
                <ul className="divide-y divide-hairline text-sm">
                  {activity.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                      <span>
                        <span className="font-medium text-ink">{a.action.replace(".", " · ").replace("_", " ")}</span>
                        <span className="text-stone-500"> {a.targetId}</span>
                        {a.detail && <span className="block text-xs text-stone-500">{a.detail}</span>}
                      </span>
                      <span className="text-xs text-stone-500">{a.admin.phone} · {when(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-600">No moderation actions yet.</p>
              )}
            </Card>
          </>
        );
      })()}
    </div>
  );
}
