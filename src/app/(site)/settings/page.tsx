import Link from "next/link";
import { cookies } from "next/headers";
import { changePassword, deleteAccount, setWhatsappOptIn } from "@/app/actions/auth";
import { cancelFamilyInvite, inviteFamilyMember, leaveManagedProfile, removeFamilyManager } from "@/app/actions/family";
import { MAX_FAMILY_MANAGERS } from "@/lib/family";
import { unblockProfile } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { SignOutButton } from "@/components/SignOutButton";
import { IdVerifiedBadge, PremiumBadge } from "@/components/Badges";
import { SelectField, TextField } from "@/components/fields";
import { NotificationPrefs } from "@/components/NotificationPrefs";
import { ReferralCard } from "@/components/ReferralCard";
import { db } from "@/lib/db";
import { deviceLabel } from "@/lib/devices";
import { dateTime } from "@/lib/format";
import { getT, getTx } from "@/lib/i18n";
import { isPremium } from "@/lib/premium";
import { requireUser } from "@/lib/session";

const RELATIONS: Record<string, string> = {
  FATHER: "Father",
  MOTHER: "Mother",
  BROTHER: "Brother",
  SISTER: "Sister",
  GUARDIAN: "Guardian",
  OTHER: "Other relative",
};

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const user = await requireUser();
  const { blocked } = await searchParams;
  const blocks = user.profile
    ? await db.block.findMany({
        where: { blockerId: user.profile.id },
        include: { blocked: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const isOwner = !!user.profile && !user.isFamilyManager;
  const [managers, invites] = isOwner
    ? await Promise.all([
        db.profileManager.findMany({ where: { profileId: user.profile!.id }, include: { user: { select: { phone: true } } } }),
        db.familyInvite.findMany({ where: { profileId: user.profile!.id, expiresAt: { gt: new Date() } } }),
      ])
    : [[], []];
  // Most recent sign-in per browser.
  const signIns = await db.loginEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    distinct: ["deviceId"],
    take: 8,
    select: { id: true, deviceId: true, userAgent: true, createdAt: true },
  });
  const thisDevice = (await cookies()).get("dm_device")?.value;
  const linkCls = "text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold";
  const [t, tx] = await Promise.all([getT(), getTx()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={t("set.eyebrow")} title={t("set.title")} subtitle={<span className="break-all">{t("set.signedInAs", { phone: user.phone })}</span>} />
      {blocked && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {t("set.blocked")}
        </p>
      )}

      {user.isFamilyManager && user.profile && (
        <Card title={t("set.family")}>
          <p className="text-sm text-stone-700">
            {t("set.youAreManaging")} <strong>{user.profile.name}</strong>
            {t("set.managingDetail", { code: user.profile.code, relation: tx(RELATIONS[user.managing!.relation]).toLowerCase() })}
          </p>
          <form action={leaveManagedProfile} className="mt-4">
            <button className="rounded-full border border-hairline px-5 py-2 text-sm text-stone-700 hover:border-gold">{t("set.stopManaging")}</button>
          </form>
        </Card>
      )}

      {user.profile && (
        <Card title={t("set.membershipCard")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-cream p-4">
              <p className="eyebrow text-gold-dark">{t("set.membership")}</p>
              {isPremium(user.profile) ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <PremiumBadge /> {t("set.until", { date: user.profile.premiumUntil!.toLocaleDateString("en-IN", { dateStyle: "medium" }) })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-stone-700">{t("set.free")}</p>
              )}
              <Link href="/upgrade" className={`mt-2 inline-block text-sm ${linkCls}`}>{t(isPremium(user.profile) ? "set.extend" : "set.upgrade")}</Link>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="eyebrow text-gold-dark">{t("set.identity")}</p>
              {user.profile.idVerifiedAt ? (
                <p className="mt-2"><IdVerifiedBadge /></p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-stone-700">{t("set.notVerified")}</p>
                  <Link href="/verify-id" className={`mt-2 inline-block text-sm ${linkCls}`}>{t("set.verifyId")}</Link>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title={t("set.whatsapp")}>
        <p className="text-sm text-stone-600">
          {t("set.whatsappBody")}
        </p>
        <form action={setWhatsappOptIn.bind(null, !user.whatsappOptIn)} className="mt-4 flex flex-wrap items-center gap-4">
          <span className={`text-sm font-medium ${user.whatsappOptIn ? "text-emerald-700" : "text-stone-500"}`}>
            {t(user.whatsappOptIn ? "set.onFor" : "set.offFor", { phone: user.phone })}
          </span>
          <button className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30">
            {t(user.whatsappOptIn ? "set.turnOff" : "set.turnOnWhatsapp")}
          </button>
        </form>
      </Card>

      <NotificationPrefs userId={user.id} />
      <ReferralCard userId={user.id} />

      {isOwner && (
        <Card title={t("set.family")}>
          <p className="text-sm text-stone-600">
            {t("set.familyBody", { max: MAX_FAMILY_MANAGERS })}
          </p>
          {(managers.length > 0 || invites.length > 0) && (
            <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
              {managers.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    {tx(RELATIONS[m.relation])} · {m.user.phone} <span className="ml-1 text-xs text-emerald-700">{t("set.active")}</span>
                  </span>
                  <form action={removeFamilyManager.bind(null, m.id)}>
                    <button className="text-red-700 hover:underline">{t("set.remove")}</button>
                  </form>
                </li>
              ))}
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    {tx(RELATIONS[i.relation])} · {i.phone} <span className="ml-1 text-xs text-amber-700">{t("set.invited")}</span>
                  </span>
                  <form action={cancelFamilyInvite.bind(null, i.id)}>
                    <button className="text-stone-600 hover:underline">{t("set.cancel")}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {managers.length + invites.length < MAX_FAMILY_MANAGERS && (
            <ActionForm action={inviteFamilyMember} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField label={t("set.theirMobile")} name="phone" type="tel" inputMode="numeric" required placeholder="98765 43210" />
              <SelectField label={t("set.relation")} name="relation" options={Object.fromEntries(Object.entries(RELATIONS).map(([k, v]) => [k, tx(v)]))} required />
              <SubmitButton>{t("set.invite")}</SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      <Card title={t("set.changePassword")}>
        <ActionForm action={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label={t("set.currentPassword")} name="current" type="password" required autoComplete="current-password" />
          </div>
          <TextField label={t("set.newPassword")} name="password" type="password" minLength={8} required autoComplete="new-password" hint={t("set.passwordHint")} />
          <TextField label={t("set.confirmNewPassword")} name="confirm" type="password" minLength={8} required autoComplete="new-password" />
          <div className="sm:col-span-2">
            <SubmitButton>{t("set.updatePassword")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card title={t("set.devices")}>
        {signIns.length > 0 && (
          <>
            <p className="eyebrow mb-2 text-gold-dark">{t("set.recentSignIns")}</p>
            <ul className="mb-5 divide-y divide-hairline rounded-xl border border-hairline">
              {signIns.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="min-w-0 font-medium text-ink">
                    {deviceLabel(e.userAgent)}
                    {e.deviceId === thisDevice && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-normal text-emerald-800">{t("set.thisDevice")}</span>}
                  </span>
                  <span className="text-xs text-stone-500">{dateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-stone-600">{t("set.devicesBody")}</p>
        <div className="mt-4">
          <SignOutButton everywhere pendingLabel={t("nav.signingOut")} className="rounded-full border border-gold/60 px-5 py-2.5 text-sm text-maroon transition hover:bg-gold-light/30">
            {t("set.logoutAll")}
          </SignOutButton>
        </div>
      </Card>

      <Card title={t("set.blockedMembers")}>
        {blocks.length ? (
          <ul className="divide-y divide-hairline">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  {b.blocked.name} <span className="text-stone-500">· {b.blocked.code}</span>
                </span>
                <form action={unblockProfile.bind(null, b.blocked.id)}>
                  <button className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{t("set.unblock")}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">{t("set.noBlocked")}</p>
        )}
      </Card>

      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-soft sm:p-7">
        <h2 className="text-2xl text-red-800">{t("set.deleteTitle")}</h2>
        <p className="mt-2 text-sm text-stone-600">
          {t(user.isFamilyManager ? "set.deleteManager" : "set.deleteOwner")}
        </p>
        <ActionForm action={deleteAccount} confirm={t("set.deleteConfirm")} className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField label={t("set.password")} name="password" type="password" required autoComplete="current-password" />
          <TextField label={t("set.typeDelete")} name="confirmText" required pattern="DELETE" autoComplete="off" />
          <div className="sm:col-span-2">
            <SubmitButton variant="danger">{t("set.deleteButton")}</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
