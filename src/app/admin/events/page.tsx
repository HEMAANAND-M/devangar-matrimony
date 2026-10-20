import Link from "next/link";
import type { Event } from "@prisma/client";
import { deleteEvent, saveEvent } from "@/app/actions/admin-content";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, EmptyState, Panel, buttonCls, inputCls } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Events" };

const SUBMIT = "!rounded-lg !px-4 !py-2 !tracking-normal !shadow-none";
const f = `${inputCls} mt-1 w-full`;
/** Value for a datetime-local input, in IST. */
const local = (d: Date | null) =>
  d ? new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 16) : "";

function EventFields({ e }: { e?: Event }) {
  return (
    <>
      <label className="block text-xs font-medium text-stone-600">
        Title
        <input name="title" required maxLength={120} defaultValue={e?.title} className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Description
        <textarea name="description" required rows={4} maxLength={2000} defaultValue={e?.description} className={f} />
      </label>
      <label className="block text-xs font-medium text-stone-600">
        Location
        <input name="location" required maxLength={160} defaultValue={e?.location} placeholder="Sri Chowdeshwari Amman Temple, Coimbatore" className={f} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-stone-600">
          Starts (IST)
          <input type="datetime-local" name="startsAt" required defaultValue={local(e?.startsAt ?? null)} className={f} />
        </label>
        <label className="block text-xs font-medium text-stone-600">
          Ends (optional)
          <input type="datetime-local" name="endsAt" defaultValue={local(e?.endsAt ?? null)} className={f} />
        </label>
      </div>
      <label className="block text-xs font-medium text-stone-600">
        Registration or details link (optional)
        <input name="href" defaultValue={e?.href ?? ""} placeholder="https://…" className={f} />
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="published" defaultChecked={e ? e.published : true} className="accent-maroon" /> Published
      </label>
    </>
  );
}

export default async function AdminEventsPage() {
  await requireAdmin();
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" }, take: 100 });
  const now = new Date();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Events"
        description="Community meets and gatherings shown on the public events page."
        actions={<Link href="/events" className={buttonCls.secondary}>View public page</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="New event">
          <ActionForm action={saveEvent.bind(null, null)} className="space-y-3">
            <EventFields />
            <SubmitButton className={`${SUBMIT} w-full`}>Add event</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title={`Events (${events.length})`}>
          {events.length ? (
            <ul className="divide-y divide-hairline">
              {events.map((e) => {
                const upcoming = (e.endsAt ?? e.startsAt) >= now;
                return (
                  <li key={e.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                          {e.title}
                          <Badge tone={!e.published ? "neutral" : upcoming ? "green" : "blue"}>{!e.published ? "Draft" : upcoming ? "Upcoming" : "Past"}</Badge>
                        </p>
                        <p className="mt-1 text-xs text-stone-500">{dateTime(e.startsAt)} · {e.location}</p>
                      </div>
                      <ActionButton variant="ghost" confirm="Delete this event?" action={deleteEvent.bind(null, e.id)}>Delete</ActionButton>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-maroon">Edit</summary>
                      <ActionForm action={saveEvent.bind(null, e.id)} className="mt-3 space-y-3 rounded-lg bg-cream/50 p-4">
                        <EventFields e={e} />
                        <SubmitButton className={SUBMIT}>Save changes</SubmitButton>
                      </ActionForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No events yet">Add sangam meets, temple festivals or matrimony gatherings.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
