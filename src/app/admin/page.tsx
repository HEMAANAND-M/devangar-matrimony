import Link from "next/link";
import { approvePhoto, approveProfile, rejectPhoto, rejectProfile, resolveReport } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [pendingProfiles, pendingPhotos, reports, stats] = await Promise.all([
    db.profile.findMany({ where: { status: "PENDING" }, include: { user: { select: { phone: true } } }, orderBy: { updatedAt: "asc" }, take: 50 }),
    db.photo.findMany({ where: { approved: false }, include: { profile: { select: { code: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }),
    db.report.findMany({ where: { resolved: false }, include: { reporter: true, target: true }, orderBy: { createdAt: "asc" } }),
    db.profile.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Moderation" title="Admin" />
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
                  {p.gender.toLowerCase()} · {ageFrom(p.dateOfBirth)} yrs · {p.city} · {p.user.phone}
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
              <img src={`/api/photos/${ph.id}`} alt="" className="aspect-[4/5] w-full object-cover" />
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
    </div>
  );
}
