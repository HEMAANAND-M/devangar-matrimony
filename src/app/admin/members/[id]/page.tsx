import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import {
  editMemberProfile, eraseAccount, forceLogout, grantPremium, resetMemberPassword, revealPhone, saveStaffNotes, setAccountStatus, setProfileStatus,
} from "@/app/actions/admin-members";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminPageHeader, Badge, EmptyState, Panel, Table, Td, buttonCls, inputCls, label, statusTone, type Tone } from "@/components/admin/ui";
import { DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, PROFILE_FOR_LABELS, RASIS, STARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ageFrom, dateOnly, dateTime, heightLabel, maskPhone } from "@/lib/format";
import { getPlans } from "@/lib/plans";
import { isPremium, rupees } from "@/lib/premium";
import { requireStaff } from "@/lib/session";
import { actionLabel } from "../../activity/labels";
import { signedPhotoUrl } from "@/lib/photo-url";

export const metadata = { title: "Member" };

const TABS = [
  ["profile", "Profile"],
  ["activity", "Timeline"],
  ["devices", "Devices"],
  ["connections", "Family & referrals"],
] as const;
type Tab = (typeof TABS)[number][0];

const memberInclude = {
  profile: {
    include: {
      photos: { select: { id: true, approved: true, isPrimary: true, createdAt: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      managers: { include: { user: { select: { id: true, phone: true, lastLoginAt: true } } } },
      familyInvites: true,
      horoscope: { select: { mime: true, uploadedAt: true } },
      _count: { select: { sentInterests: true, receivedInterests: true, shortlistedBy: true, viewsReceived: true, reportsReceived: true } },
    },
  },
  managing: { include: { profile: { select: { userId: true, code: true, name: true } } } },
  referredBy: { select: { id: true, profile: { select: { code: true, name: true } } } },
  referrals: { select: { id: true, createdAt: true, profile: { select: { code: true, name: true, status: true } } }, orderBy: { createdAt: "desc" } },
  _count: { select: { loginEvents: true } },
} satisfies Prisma.UserInclude;
type MemberUser = Prisma.UserGetPayload<{ include: typeof memberInclude }>;

type Event = { at: Date; title: string; detail?: string; tone: Tone };

/** Short "Chrome on Android" style label from a user agent string. */
function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

const submitCls = "!rounded-lg !px-3.5 !py-2";

function Facts({ rows, compact = false }: { rows: [string, React.ReactNode][]; compact?: boolean }) {
  return (
    <dl className={`grid gap-x-8 gap-y-2.5 text-sm ${compact ? "" : "sm:grid-cols-2"}`}>
      {rows.map(([k, v]) => (
        <div key={k} className={compact ? "flex justify-between gap-3" : "flex gap-3"}>
          <dt className={compact ? "text-stone-500" : "w-36 shrink-0 text-stone-500"}>{k}</dt>
          <dd className={`min-w-0 break-words text-ink ${compact ? "text-right tabular-nums" : ""}`}>
            {v === null || v === undefined || v === "" ? <span className="text-stone-400">—</span> : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const staff = await requireStaff();
  const isAdmin = staff.role === "ADMIN";
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find(([t]) => t === requested)?.[0] ?? "profile";

  const user = await db.user.findUnique({ where: { id }, include: memberInclude });
  if (!user) notFound();
  if (user.role !== "USER") {
    return (
      <Panel>
        <EmptyState title="This is a staff account">Staff accounts are managed on the <Link href="/admin/staff" className="text-maroon underline">Staff page</Link>.</EmptyState>
      </Panel>
    );
  }
  const p = user.profile;
  const name = p?.name ?? (user.managing ? `Family manager of ${user.managing.profile.code}` : "Account without a profile");

  const header = (
    <AdminPageHeader
      breadcrumbs={[["/admin", "Admin"], ["/admin/members", "Members"]]}
      title={name}
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          {p && <span className="mr-1 font-medium text-stone-700">{p.code}</span>}
          <span className="mr-1">{maskPhone(user.phone)}</span>
          {p && <Badge tone={statusTone(p.status)}>Profile: {label(p.status)}</Badge>}
          <Badge tone={statusTone(user.status)}>Account: {label(user.status)}</Badge>
          {!user.phoneVerified && <Badge tone="amber">Phone unverified</Badge>}
          {isPremium(p) && <Badge tone="gold">Premium until {dateOnly(p!.premiumUntil!)}</Badge>}
          {p?.idVerifiedAt && <Badge tone="blue">ID verified</Badge>}
          {p?.photoVerifiedAt && <Badge tone="blue">Photo verified</Badge>}
          {p?.flags.map((f) => <Badge key={f} tone="red">⚑ {label(f)}</Badge>)}
        </span>
      }
      actions={
        <>
          {p && p.status !== "MARRIED" && (
            <Link href={`/profiles/${p.code}`} className={buttonCls.secondary} target="_blank">View public profile</Link>
          )}
          {isAdmin && <a href={`/api/admin/members/${user.id}/export`} className={buttonCls.secondary}>Export data</a>}
        </>
      }
    />
  );

  const tabs = (
    <nav aria-label="Member sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline">
      {TABS.map(([key, text]) => (
        <Link
          key={key}
          href={key === "profile" ? `/admin/members/${user.id}` : `/admin/members/${user.id}?tab=${key}`}
          aria-current={tab === key ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${tab === key ? "border-maroon font-medium text-maroon" : "border-transparent text-stone-600 hover:text-ink"}`}
        >
          {text}
        </Link>
      ))}
    </nav>
  );

  return (
    <div>
      {header}
      {user.status !== "ACTIVE" && (
        <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{label(user.status)}</strong>
          {user.suspendedUntil && ` until ${dateOnly(user.suspendedUntil)}`}
          {user.statusReason && ` · ${user.statusReason}`}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {tabs}
          {tab === "profile" && <ProfileTab user={user} isAdmin={isAdmin} />}
          {tab === "activity" && <TimelineTab userId={user.id} profileId={p?.id ?? null} photoIds={p?.photos.map((ph) => ph.id) ?? []} isAdmin={isAdmin} />}
          {tab === "devices" && <DevicesTab userId={user.id} />}
          {tab === "connections" && <ConnectionsTab user={user} />}
        </div>
        <aside className="space-y-5">
          <Panel title="At a glance">
            <Facts
              compact
              rows={[
                ["Joined", dateTime(user.createdAt)],
                ["Last sign-in", user.lastLoginAt ? dateTime(user.lastLoginAt) : "Never"],
                ["Last active", user.lastActiveAt ? dateTime(user.lastActiveAt) : "—"],
                ["Sign-ins", user._count.loginEvents],
                ...(p
                  ? ([
                      ["Interests sent", p._count.sentInterests],
                      ["Interests received", p._count.receivedInterests],
                      ["Profile views", p._count.viewsReceived],
                      ["Shortlisted by", p._count.shortlistedBy],
                      ["Reports against", p._count.reportsReceived],
                    ] as [string, React.ReactNode][])
                  : []),
              ]}
            />
          </Panel>
          {p && (
            <Panel title="Staff notes" description="Visible to staff only.">
              <ActionForm action={saveStaffNotes.bind(null, p.id)} className="space-y-3">
                <textarea name="notes" defaultValue={p.staffNotes ?? ""} rows={4} className={`${inputCls} w-full`} placeholder="e.g. Called father on 12 Oct; documents look genuine." />
                <SubmitButton variant="secondary" className={submitCls}>Save notes</SubmitButton>
              </ActionForm>
            </Panel>
          )}
          {isAdmin && <AdminActions user={user} />}
        </aside>
      </div>
    </div>
  );
}

function ProfileTab({ user, isAdmin }: { user: MemberUser; isAdmin: boolean }) {
  const p = user.profile;
  if (!p) {
    return (
      <Panel>
        <EmptyState title="No profile yet">
          {user.managing ? (
            <>This account manages <Link href={`/admin/members/${user.managing.profile.userId}`} className="text-maroon underline">{user.managing.profile.name} ({user.managing.profile.code})</Link>.</>
          ) : (
            "The member registered but has not created a profile."
          )}
        </EmptyState>
      </Panel>
    );
  }
  const fieldCls = `${inputCls} w-full`;
  return (
    <div className="space-y-5">
      <Panel title={`Photos (${p.photos.length})`}>
        {p.photos.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {p.photos.map((ph) => (
              <a key={ph.id} href={signedPhotoUrl(ph.id)} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-lg border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route */}
                <img src={signedPhotoUrl(ph.id, "thumb")} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition group-hover:scale-[1.02]" />
                <span className="absolute left-1.5 top-1.5 flex gap-1">
                  {ph.isPrimary && <Badge tone="maroon">Main</Badge>}
                  {!ph.approved && <Badge tone="amber">Pending</Badge>}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">No photos uploaded.</p>
        )}
      </Panel>
      <Panel title="Basic details">
        <Facts
          rows={[
            ["Profile for", PROFILE_FOR_LABELS[p.profileFor]],
            ["Gender", p.gender === "FEMALE" ? "Bride" : "Groom"],
            ["Date of birth", `${dateOnly(p.dateOfBirth)} (${ageFrom(p.dateOfBirth)} yrs)`],
            ["Marital status", MARITAL_STATUS_LABELS[p.maritalStatus]],
            ["Height", heightLabel(p.heightCm)],
            ["Mother tongue", p.motherTongue],
            ["Languages", p.languages.join(", ")],
            ["Diet", p.diet],
            ["Complexion", p.complexion],
            ["Location", [p.city, p.state, p.country].filter(Boolean).join(", ")],
            ["Native place", p.nativePlace],
            ["Education", p.education],
            ["Occupation", p.occupation],
            ["Annual income", p.annualIncome],
          ]}
        />
        {p.about && <p className="mt-4 whitespace-pre-line border-t border-hairline pt-4 text-sm text-stone-700">{p.about}</p>}
      </Panel>
      <Panel title="Community & horoscope">
        <Facts
          rows={[
            ["Sub-sect", p.subSect],
            ["Gothram", p.gothram],
            ["Kuladeivam", p.kuladeivam],
            ["Star", p.star],
            ["Rasi", p.rasi],
            ["Lagnam", p.lagnam],
            ["Dosham", DOSHAM_LABELS[p.dosham]],
            ["Birth time / place", [p.birthTime, p.birthPlace].filter(Boolean).join(" · ")],
            ["Horoscope file", p.horoscope ? `${p.horoscope.mime === "application/pdf" ? "PDF" : "Image"} · uploaded ${dateOnly(p.horoscope.uploadedAt)}` : null],
          ]}
        />
      </Panel>
      <Panel title="Family & preferences">
        <Facts
          rows={[
            ["Father", [p.fatherName, p.fatherOccupation].filter(Boolean).join(" · ")],
            ["Mother", [p.motherName, p.motherOccupation].filter(Boolean).join(" · ")],
            ["Siblings", p.siblings],
            ["Family type / status", [p.familyType, p.familyStatus].filter(Boolean).join(" · ")],
            ["Preferred age", p.prefAgeMin || p.prefAgeMax ? `${p.prefAgeMin ?? 18}–${p.prefAgeMax ?? "any"}` : null],
            ["Preferred marital status", p.prefMaritalStatus.map((m) => MARITAL_STATUS_LABELS[m]).join(", ")],
            ["Avoid own gothram", p.prefExcludeOwnGothram ? "Yes" : "No"],
            ["Preferred stars", p.prefStars.join(", ")],
            ["Preferred cities", p.prefCities.join(", ")],
            ["Notes", p.prefNotes],
          ]}
        />
        {p.rejectionReason && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Last rejection reason: {p.rejectionReason}</p>
        )}
      </Panel>
      {isAdmin && (
        <Panel title="Edit profile on the member's behalf" description="Changes are recorded in the activity log with the fields that changed.">
          <ActionForm action={editMemberProfile.bind(null, p.id)} className="grid gap-4 sm:grid-cols-2">
            {([
              ["name", "Full name", p.name],
              ["education", "Education", p.education],
              ["occupation", "Occupation", p.occupation],
              ["annualIncome", "Annual income", p.annualIncome],
              ["city", "City", p.city],
              ["state", "State", p.state],
              ["gothram", "Gothram", p.gothram],
              ["heightCm", "Height (cm)", p.heightCm],
            ] as const).map(([field, text, value]) => (
              <label key={field} className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                {text}
                <input name={field} defaultValue={value ?? ""} className={fieldCls} />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Marital status
              <select name="maritalStatus" defaultValue={p.maritalStatus} className={fieldCls}>
                {Object.entries(MARITAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Mother tongue
              <select name="motherTongue" defaultValue={p.motherTongue} className={fieldCls}>
                {MOTHER_TONGUES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Star
              <select name="star" defaultValue={p.star ?? ""} className={fieldCls}>
                <option value="">—</option>
                {STARS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Rasi
              <select name="rasi" defaultValue={p.rasi ?? ""} className={fieldCls}>
                <option value="">—</option>
                {RASIS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600 sm:col-span-2">
              About
              <textarea name="about" defaultValue={p.about ?? ""} rows={4} className={fieldCls} />
            </label>
            <div className="sm:col-span-2"><SubmitButton className={submitCls}>Save changes</SubmitButton></div>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}

async function TimelineTab({ userId, profileId, photoIds, isAdmin }: { userId: string; profileId: string | null; photoIds: string[]; isAdmin: boolean }) {
  const [logs, logins, sent, received, payments, reportsBy, reportsAgainst, verifications] = await Promise.all([
    db.adminLog.findMany({
      where: { targetId: { in: [userId, ...(profileId ? [profileId] : []), ...photoIds] } },
      include: { admin: { select: { role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    profileId ? db.interest.findMany({ where: { fromId: profileId }, include: { to: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    profileId ? db.interest.findMany({ where: { toId: profileId }, include: { from: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    profileId && isAdmin ? db.payment.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } }) : [],
    profileId ? db.report.findMany({ where: { reporterId: profileId }, include: { target: { select: { code: true } } }, orderBy: { createdAt: "desc" } }) : [],
    profileId ? db.report.findMany({ where: { targetId: profileId }, include: { reporter: { select: { code: true } } }, orderBy: { createdAt: "desc" } }) : [],
    profileId ? db.idVerification.findMany({ where: { profileId }, select: { id: true, docType: true, status: true, createdAt: true, reviewedAt: true, rejectionReason: true }, orderBy: { createdAt: "desc" } }) : [],
  ]);

  const events: Event[] = [
    ...logs.map((l) => ({ at: l.createdAt, title: `${actionLabel(l.action)} (${label(l.admin.role)})`, detail: l.detail ?? undefined, tone: "maroon" as Tone })),
    ...logins.map((l) => ({ at: l.createdAt, title: "Signed in", detail: deviceLabel(l.userAgent), tone: "neutral" as Tone })),
    ...sent.map((i) => ({ at: i.createdAt, title: `Sent interest to ${i.to.code}`, detail: label(i.status), tone: "blue" as Tone })),
    ...received.map((i) => ({ at: i.createdAt, title: `Received interest from ${i.from.code}`, detail: label(i.status), tone: "blue" as Tone })),
    ...payments.map((pay) => ({
      at: pay.paidAt ?? pay.createdAt,
      title: `${pay.offline ? "Premium granted" : "Payment"} · ${rupees(pay.amount)}`,
      detail: `${label(pay.status)} · ${pay.plan} · ${pay.months} months${pay.demo ? " · demo" : ""}`,
      tone: (pay.status === "PAID" ? "gold" : "neutral") as Tone,
    })),
    ...reportsBy.map((r) => ({ at: r.createdAt, title: `Reported ${r.target.code}`, detail: `${label(r.category)} · ${r.reason.slice(0, 120)}`, tone: "amber" as Tone })),
    ...reportsAgainst.map((r) => ({ at: r.createdAt, title: `Reported by ${r.reporter.code}`, detail: `${label(r.category)} · ${r.reason.slice(0, 120)}${r.resolved ? " · resolved" : ""}`, tone: "red" as Tone })),
    ...verifications.map((v) => ({
      at: v.createdAt,
      title: `${v.docType === "SELFIE" ? "Selfie check" : `${label(v.docType)} verification`} submitted`,
      detail: `${label(v.status)}${v.rejectionReason ? ` · ${v.rejectionReason}` : ""}`,
      tone: statusTone(v.status),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (!events.length) return <Panel><EmptyState title="Nothing recorded yet" /></Panel>;
  return (
    <Panel flush>
      <ol className="divide-y divide-hairline">
        {events.slice(0, 200).map((e, i) => (
          <li key={i} className="flex gap-4 px-5 py-3">
            <span className="w-36 shrink-0 text-xs tabular-nums text-stone-500">{dateTime(e.at)}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm text-ink">
                <span className={`h-2 w-2 shrink-0 rounded-full ${{ maroon: "bg-maroon", neutral: "bg-stone-300", blue: "bg-sky-500", gold: "bg-gold", amber: "bg-amber-500", red: "bg-red-600", green: "bg-emerald-600" }[e.tone]}`} aria-hidden />
                {e.title}
              </span>
              {e.detail && <span className="mt-0.5 block pl-4 text-xs text-stone-500">{e.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

async function DevicesTab({ userId }: { userId: string }) {
  const devices = await db.loginEvent.groupBy({
    by: ["deviceId", "userAgent"],
    where: { userId },
    _count: true,
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
  });
  const deviceIds = [...new Set(devices.map((d) => d.deviceId))];
  const shared = deviceIds.length
    ? await db.loginEvent.findMany({
        where: { deviceId: { in: deviceIds }, userId: { not: userId } },
        distinct: ["userId"],
        select: { deviceId: true, user: { select: { id: true, phone: true, role: true, profile: { select: { code: true, name: true } } } } },
      })
    : [];
  return (
    <div className="space-y-5">
      <Panel title="Devices used to sign in" flush>
        {devices.length ? (
          <Table head={["Device", "Sign-ins", "First seen", "Last seen"]}>
            {devices.map((d) => (
              <tr key={`${d.deviceId}-${d.userAgent}`}>
                <Td>
                  <span className="font-medium text-ink">{deviceLabel(d.userAgent)}</span>
                  <span className="block font-mono text-[0.7rem] text-stone-400">{d.deviceId.slice(0, 12)}</span>
                </Td>
                <Td className="tabular-nums">{d._count}</Td>
                <Td className="whitespace-nowrap text-stone-600">{d._min.createdAt && dateTime(d._min.createdAt)}</Td>
                <Td className="whitespace-nowrap text-stone-600">{d._max.createdAt && dateTime(d._max.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No sign-ins recorded">Sign-ins are recorded from this release onwards.</EmptyState>
        )}
      </Panel>
      <Panel
        title="Other accounts on the same devices"
        description="Several accounts from one phone can be a family sharing it, or one person running duplicate profiles."
        flush
      >
        {shared.length ? (
          <ul className="divide-y divide-hairline text-sm">
            {shared.map((s) => (
              <li key={s.user.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <Link href={`/admin/members/${s.user.id}`} className="text-maroon hover:underline">
                  {s.user.profile ? `${s.user.profile.name} (${s.user.profile.code})` : maskPhone(s.user.phone)}
                </Link>
                {s.user.role !== "USER" && <Badge tone="neutral">{label(s.user.role)}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-stone-500">None found.</p>
        )}
      </Panel>
    </div>
  );
}

function ConnectionsTab({ user }: { user: MemberUser }) {
  const p = user.profile;
  return (
    <div className="space-y-5">
      <Panel title="Family members managing this profile" flush>
        {p?.managers.length ? (
          <Table head={["Account", "Relation", "Since", "Last sign-in"]}>
            {p.managers.map((m) => (
              <tr key={m.id}>
                <Td><Link href={`/admin/members/${m.user.id}`} className="text-maroon hover:underline">{maskPhone(m.user.phone)}</Link></Td>
                <Td>{label(m.relation)}</Td>
                <Td className="text-stone-600">{dateOnly(m.createdAt)}</Td>
                <Td className="text-stone-600">{m.user.lastLoginAt ? dateTime(m.user.lastLoginAt) : "Never"}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="px-5 py-4 text-sm text-stone-500">{user.managing ? `This account is itself a family manager of ${user.managing.profile.code}.` : "No family managers."}</p>
        )}
        {!!p?.familyInvites.length && (
          <p className="border-t border-hairline px-5 py-3 text-xs text-stone-500">
            Pending invites: {p.familyInvites.map((i) => `${maskPhone(i.phone)} (${label(i.relation)})`).join(", ")}
          </p>
        )}
      </Panel>
      <Panel title="Referrals" description={user.referralCode ? `Referral code ${user.referralCode}` : undefined} flush>
        {user.referredBy && (
          <p className="border-b border-hairline px-5 py-3 text-sm">
            Joined through <Link href={`/admin/members/${user.referredBy.id}`} className="text-maroon hover:underline">{user.referredBy.profile ? `${user.referredBy.profile.name} (${user.referredBy.profile.code})` : "another member"}</Link>
          </p>
        )}
        {user.referrals.length ? (
          <ul className="divide-y divide-hairline text-sm">
            {user.referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <Link href={`/admin/members/${r.id}`} className="text-maroon hover:underline">{r.profile ? `${r.profile.name} (${r.profile.code})` : "No profile yet"}</Link>
                <span className="flex items-center gap-2 text-xs text-stone-500">
                  {r.profile && <Badge tone={statusTone(r.profile.status)}>{label(r.profile.status)}</Badge>}
                  {dateOnly(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-stone-500">Has not referred anyone yet.</p>
        )}
      </Panel>
    </div>
  );
}

async function AdminActions({ user }: { user: MemberUser }) {
  const plans = await getPlans({ includeInactive: true });
  const p = user.profile;
  const fieldCls = `${inputCls} w-full`;
  return (
    <>
      <Panel title="Account">
        <div className="flex flex-wrap gap-2">
          <ActionButton action={revealPhone.bind(null, user.id)} doneLabel="Shown" pendingLabel="Loading…">Show phone number</ActionButton>
          <ActionButton action={forceLogout.bind(null, user.id)} confirm="Sign this member out on every device?">Force sign-out</ActionButton>
          <ActionButton action={resetMemberPassword.bind(null, user.id)} confirm="Replace this member's password with a temporary one? They will be signed out everywhere.">
            Reset password
          </ActionButton>
        </div>
        <p className="mt-3 text-xs text-stone-500">Viewing the phone number is recorded in the activity log.</p>
      </Panel>

      <Panel title="Account status">
        <ActionForm action={setAccountStatus.bind(null, user.id)} className="space-y-3">
          <select name="status" defaultValue={user.status} className={fieldCls} aria-label="Account status">
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
          </select>
          <input name="reason" defaultValue={user.statusReason ?? ""} placeholder="Reason (shown to the member)" className={fieldCls} />
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Suspended until (optional)
            <input type="date" name="until" defaultValue={user.suspendedUntil?.toISOString().slice(0, 10) ?? ""} className={fieldCls} />
          </label>
          <SubmitButton variant="secondary" className={submitCls}>Update status</SubmitButton>
        </ActionForm>
      </Panel>

      {p && (
        <>
          <Panel title="Profile status">
            <ActionForm action={setProfileStatus.bind(null, p.id)} className="space-y-3">
              <select name="status" defaultValue={p.status} className={fieldCls} aria-label="Profile status">
                {["PENDING", "APPROVED", "REJECTED", "HIDDEN", "MARRIED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
              <input name="reason" placeholder="Reason (required for rejection)" className={fieldCls} />
              <SubmitButton variant="secondary" className={submitCls}>Change status</SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs text-stone-500">“Married” removes the profile from search and counts it as a success story.</p>
          </Panel>

          <Panel title="Grant premium" description={isPremium(p) ? `Active until ${dateOnly(p.premiumUntil!)}; time is added to the end.` : "For cash, bank transfer or complimentary memberships."}>
            <ActionForm action={grantPremium.bind(null, p.id)} className="space-y-3">
              <select name="plan" defaultValue="" className={fieldCls} aria-label="Plan">
                <option value="">Custom number of months</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.months} months · {rupees(plan.amount)}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="months" type="number" min={1} max={24} placeholder="Months" className={fieldCls} aria-label="Months" />
                <input name="amount" type="number" min={0} step="1" placeholder="₹ received" className={fieldCls} aria-label="Amount received in rupees" />
              </div>
              <input name="note" placeholder="Note, e.g. cash at Salem office" className={fieldCls} required />
              <SubmitButton className={submitCls}>Grant premium</SubmitButton>
            </ActionForm>
          </Panel>
        </>
      )}

      <Panel title="Erase account" className="border-red-200">
        <p className="mb-3 text-xs text-stone-600">
          Permanently deletes the account, profile, photos and messages. Payment records are kept without the member link, for tax purposes. Export the data first if the member asked for a copy.
        </p>
        <ActionForm action={eraseAccount.bind(null, user.id)} className="space-y-3" confirm="Erase this account permanently? This cannot be undone.">
          <input name="reason" placeholder="Reason, e.g. member request by phone 12 Oct" className={fieldCls} />
          <input name="confirm" placeholder="Type ERASE" autoComplete="off" className={fieldCls} aria-label="Type ERASE to confirm" />
          <SubmitButton variant="danger" className={submitCls}>Erase account</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
