import Link from "next/link";
import { approvePhoto, approveProfile, approveProfiles, rejectPhoto, rejectProfile } from "@/app/actions/admin";
import { AdminPageHeader, Badge, EmptyState, Panel, Table, Td, buttonCls, statusTone, label } from "@/components/admin/ui";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, PROFILE_FOR_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ensurePhotoHashes, refreshFlags } from "@/lib/flags";
import { ageFrom, dateOnly, dateTime, heightLabel, maskPhone } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { ApproveButton, BulkAction, RejectForm, ReviewShortcuts, SelectAll } from "./_components/moderation";
import { FlagBadges, FlagList, PHOTO_REJECT_REASONS, PROFILE_REJECT_REASONS, Tabs, waited } from "./_components/shared";
import { signedPhotoUrl } from "@/lib/photo-url";

export const metadata = { title: "Profile approvals" };

type Search = { mode?: string; id?: string };

function Facts({ title, rows }: { title: string; rows: [string, string | number | null | undefined][] }) {
  const filled = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <div>
      <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</h3>
      {filled.length ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {filled.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-32 shrink-0 text-stone-500">{k}</dt>
              <dd className="min-w-0 break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm italic text-stone-400">Not provided</p>
      )}
    </div>
  );
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const { mode = "review", id } = await searchParams;

  await ensurePhotoHashes(30);
  const queue = await db.profile.findMany({
    where: { status: "PENDING" },
    select: {
      id: true, code: true, name: true, gender: true, dateOfBirth: true, city: true, flags: true, updatedAt: true, createdAt: true,
      _count: { select: { photos: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  const oldest = queue[0];
  const header = (
    <AdminPageHeader
      title="Profile approvals"
      description={
        queue.length ? (
          <>
            {queue.length} waiting · oldest has waited <strong className="text-ink">{waited(oldest.updatedAt)}</strong>
          </>
        ) : (
          "Every new or edited profile is checked here before members can see it."
        )
      }
    />
  );
  const tabs = (
    <Tabs
      active={mode === "list" ? "list" : "review"}
      tabs={[
        { key: "review", label: "Review one by one", href: "/admin/approvals" },
        { key: "list", label: "List", href: "/admin/approvals?mode=list", count: queue.length },
      ]}
    />
  );

  if (mode === "list") {
    // Flags for the first page of the queue, so the list shows current warnings.
    await Promise.all(queue.slice(0, 15).map((p) => refreshFlags(p.id).then((flags) => (p.flags = flags))));
    return (
      <div>
        {header}
        {tabs}
        <Panel
          flush
          title="Waiting for review"
          actions={queue.length ? <BulkAction formId="approve-list" action={approveProfiles} label="Approve selected" /> : null}
        >
          {queue.length ? (
            <form id="approve-list">
              <Table head={[<SelectAll key="all" formId="approve-list" />, "Member", "Details", "Photos", "Flags", "Waiting", ""]}>
                {queue.map((p) => (
                  <tr key={p.id} className="hover:bg-cream/50">
                    <Td><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.code}`} className="h-4 w-4 accent-maroon" /></Td>
                    <Td>
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-stone-500">{p.code} · joined {dateOnly(p.createdAt)}</p>
                    </Td>
                    <Td className="text-stone-600">{label(p.gender)} · {ageFrom(p.dateOfBirth)} yrs · {p.city}</Td>
                    <Td className="tabular-nums">{p._count.photos}</Td>
                    <Td><FlagBadges flags={p.flags} /></Td>
                    <Td className="whitespace-nowrap text-stone-600">{waited(p.updatedAt)}</Td>
                    <Td><Link href={`/admin/approvals?id=${p.id}`} className={buttonCls.secondary}>Review</Link></Td>
                  </tr>
                ))}
              </Table>
            </form>
          ) : (
            <EmptyState title="All caught up">No profiles are waiting for review.</EmptyState>
          )}
        </Panel>
      </div>
    );
  }

  const index = Math.max(0, id ? queue.findIndex((p) => p.id === id) : 0);
  const currentId = id ?? queue[0]?.id;
  if (!currentId) {
    return (
      <div>
        {header}
        {tabs}
        <Panel><EmptyState title="All caught up">No profiles are waiting for review. New and edited profiles will appear here.</EmptyState></Panel>
      </div>
    );
  }

  const p = await db.profile.findUnique({
    where: { id: currentId },
    include: {
      photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true, approved: true, isPrimary: true, createdAt: true } },
      horoscope: { select: { mime: true, uploadedAt: true } },
      user: { select: { id: true, phone: true, createdAt: true, lastLoginAt: true, status: true } },
      managers: { select: { relation: true, user: { select: { phone: true } } } },
      reportsReceived: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, category: true, reason: true, resolved: true, createdAt: true } },
    },
  });
  if (!p) {
    return (
      <div>
        {header}
        {tabs}
        <Panel><EmptyState title="Profile not found">It may have been deleted. <Link href="/admin/approvals" className="text-maroon underline">Back to the queue</Link></EmptyState></Panel>
      </div>
    );
  }
  const flags = await refreshFlags(p.id);
  const history = await db.adminLog.findMany({
    where: { targetId: p.id, action: { startsWith: "profile." } },
    include: { admin: { select: { phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const inQueue = queue.findIndex((q) => q.id === p.id) >= 0;
  const pos = inQueue ? index : -1;
  const prev = pos > 0 ? queue[pos - 1] : undefined;
  // After a decision this profile leaves the queue, so "next" is whatever follows it now.
  const next = inQueue ? queue[pos + 1] : queue[0];
  const href = (q?: { id: string }) => (q ? `/admin/approvals?id=${q.id}` : undefined);
  const afterDecision = href(next) ?? "/admin/approvals";
  const age = ageFrom(p.dateOfBirth);

  return (
    <div>
      {header}
      {tabs}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          {inQueue ? <span className="tabular-nums">{pos + 1} of {queue.length}</span> : <Badge tone={statusTone(p.status)}>{label(p.status)}</Badge>}
          {prev && <Link href={href(prev)!} className={buttonCls.ghost}>← Previous</Link>}
          {next && <Link href={href(next)!} className={buttonCls.ghost}>Next →</Link>}
        </div>
        <ReviewShortcuts prevHref={href(prev)} nextHref={href(next)} approveId="approve-profile" rejectInputId="reject-reason" />
      </div>

      {!inQueue && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          This profile is not waiting for review (status: {label(p.status)}). {queue.length ? <Link href="/admin/approvals" className="underline">Go to the next in the queue</Link> : "The queue is empty."}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel
            title={
              <span className="flex flex-wrap items-center gap-2">
                {p.name} <span className="font-normal text-stone-500">{p.code}</span>
                <FlagBadges flags={flags} />
              </span>
            }
            description={`${label(p.gender)} · ${age} yrs · ${p.city}, ${p.state} · profile for ${PROFILE_FOR_LABELS[p.profileFor]?.toLowerCase()} · waiting ${waited(p.updatedAt)}`}
            actions={<Link href={`/profiles/${p.code}`} target="_blank" className={buttonCls.ghost}>Member view ↗</Link>}
          >
            <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-500">Photos ({p.photos.length})</h3>
            {p.photos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {p.photos.map((ph) => (
                  <div key={ph.id} className="overflow-hidden rounded-lg border border-hairline">
                    <a href={signedPhotoUrl(ph.id)} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
                      <img src={signedPhotoUrl(ph.id, "thumb")} alt={`Photo of ${p.code}`} loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-sand object-cover" />
                    </a>
                    <div className="space-y-2 p-2">
                      <div className="flex flex-wrap gap-1">
                        {ph.isPrimary && <Badge tone="gold">Primary</Badge>}
                        <Badge tone={ph.approved ? "green" : "amber"}>{ph.approved ? "Approved" : "Pending"}</Badge>
                      </div>
                      {!ph.approved && (
                        <>
                          <ApproveButton action={approvePhoto.bind(null, ph.id)} label="Approve photo" className="w-full !py-1.5" />
                          <RejectForm action={rejectPhoto.bind(null, ph.id)} reasons={PHOTO_REJECT_REASONS.slice(0, 3)} compact label="Reject" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-stone-400">No photos uploaded.</p>
            )}
          </Panel>

          <Panel title="Profile details">
            <div className="space-y-6">
              {p.about && (
                <div>
                  <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-500">About</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{p.about}</p>
                </div>
              )}
              <Facts
                title="Basics"
                rows={[
                  ["Date of birth", dateOnly(p.dateOfBirth)],
                  ["Marital status", MARITAL_STATUS_LABELS[p.maritalStatus]],
                  ["Height", heightLabel(p.heightCm)],
                  ["Mother tongue", p.motherTongue],
                  ["Sub-sect", p.subSect],
                  ["Languages", p.languages.join(", ")],
                  ["Diet", p.diet],
                  ["Complexion", p.complexion],
                ]}
              />
              <Facts
                title="Community & horoscope"
                rows={[
                  ["Gothram", p.gothram],
                  ["Kuladeivam", p.kuladeivam],
                  ["Star", p.star],
                  ["Rasi", p.rasi],
                  ["Lagnam", p.lagnam],
                  ["Dosham", DOSHAM_LABELS[p.dosham]],
                  ["Birth place", p.birthPlace],
                  ["Birth time", p.birthTime],
                  ["Horoscope file", p.horoscope ? `Uploaded ${dateOnly(p.horoscope.uploadedAt)} (${p.horoscope.mime === "application/pdf" ? "PDF" : "image"})` : null],
                ]}
              />
              <Facts
                title="Education & career"
                rows={[
                  ["Education", p.education],
                  ["Occupation", p.occupation],
                  ["Annual income", p.annualIncome],
                ]}
              />
              <Facts
                title="Family"
                rows={[
                  ["Father", [p.fatherName, p.fatherOccupation].filter(Boolean).join(" · ")],
                  ["Mother", [p.motherName, p.motherOccupation].filter(Boolean).join(" · ")],
                  ["Siblings", p.siblings],
                  ["Family type", p.familyType],
                  ["Family status", p.familyStatus],
                  ["Native place", p.nativePlace],
                ]}
              />
              <Facts
                title="Partner preferences"
                rows={[
                  ["Age", p.prefAgeMin || p.prefAgeMax ? `${p.prefAgeMin ?? "any"} – ${p.prefAgeMax ?? "any"}` : null],
                  ["Marital status", p.prefMaritalStatus.map((m) => MARITAL_STATUS_LABELS[m]).join(", ")],
                  ["Stars", p.prefStars.join(", ")],
                  ["Dosham", p.prefDosham ? DOSHAM_LABELS[p.prefDosham] : null],
                  ["Cities", p.prefCities.join(", ")],
                  ["Education", p.prefEducation],
                  ["Own gothram", p.prefExcludeOwnGothram ? "Excluded" : "Allowed"],
                  ["Notes", p.prefNotes],
                ]}
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Decision">
            <div className="space-y-4">
              <ApproveButton id="approve-profile" action={approveProfile.bind(null, p.id)} nextHref={afterDecision} label="Approve profile" className="w-full" />
              <div className="border-t border-hairline pt-4">
                <p className="mb-2 text-xs font-medium text-stone-600">Reject with a reason</p>
                <RejectForm action={rejectProfile.bind(null, p.id)} reasons={PROFILE_REJECT_REASONS} inputId="reject-reason" onDoneHref={afterDecision} label="Reject profile" />
              </div>
              {p.rejectionReason && <p className="text-xs text-stone-500">Previously rejected: “{p.rejectionReason}”</p>}
            </div>
          </Panel>

          <Panel title="Automatic checks">
            <FlagList flags={flags} />
          </Panel>

          <Panel title="Account">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-stone-500">Mobile</dt><dd className="tabular-nums">{isAdmin ? p.user.phone : maskPhone(p.user.phone)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-stone-500">Joined</dt><dd>{dateOnly(p.user.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-stone-500">Last login</dt><dd>{p.user.lastLoginAt ? dateTime(p.user.lastLoginAt) : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-stone-500">Account</dt><dd><Badge tone={statusTone(p.user.status)}>{label(p.user.status)}</Badge></dd></div>
              {p.managers.map((m, i) => (
                <div key={i} className="flex justify-between gap-3"><dt className="text-stone-500">Family ({label(m.relation)})</dt><dd className="tabular-nums">{maskPhone(m.user.phone)}</dd></div>
              ))}
            </dl>
            <Link href={`/admin/members/${p.user.id}`} className={`${buttonCls.secondary} mt-4 w-full`}>Open member record</Link>
          </Panel>

          <Panel title="History">
            {history.length || p.reportsReceived.length ? (
              <ul className="space-y-2.5 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <p className="font-medium text-ink">{h.action === "profile.approve" ? "Approved" : h.action === "profile.reject" ? "Rejected" : label(h.action.replace("profile.", ""))}</p>
                    {h.detail && <p className="text-xs text-stone-600">“{h.detail}”</p>}
                    <p className="text-xs text-stone-500">{dateTime(h.createdAt)} · {maskPhone(h.admin.phone)}</p>
                  </li>
                ))}
                {p.reportsReceived.map((r) => (
                  <li key={r.id}>
                    <p className="font-medium text-ink">
                      Reported: {label(r.category)} {r.resolved ? <Badge>Resolved</Badge> : <Badge tone="amber">Open</Badge>}
                    </p>
                    <p className="line-clamp-2 text-xs text-stone-600">{r.reason}</p>
                    <p className="text-xs text-stone-500">{dateTime(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">No previous decisions or reports.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
