import Link from "next/link";
import { changePassword, deleteAccount, logoutEverywhere, setWhatsappOptIn } from "@/app/actions/auth";
import { cancelFamilyInvite, inviteFamilyMember, leaveManagedProfile, removeFamilyManager } from "@/app/actions/family";
import { MAX_FAMILY_MANAGERS } from "@/lib/family";
import { unblockProfile } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { IdVerifiedBadge, PremiumBadge } from "@/components/Badges";
import { SelectField, TextField } from "@/components/fields";
import { db } from "@/lib/db";
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
  const linkCls = "text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Settings" subtitle={`Signed in as ${user.phone}`} />
      {blocked && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Member blocked. You will no longer see each other.
        </p>
      )}

      {user.isFamilyManager && user.profile && (
        <Card title="Family access">
          <p className="text-sm text-stone-700">
            You are managing <strong>{user.profile.name}</strong>’s profile ({user.profile.code}) as their{" "}
            {RELATIONS[user.managing!.relation].toLowerCase()}.
          </p>
          <form action={leaveManagedProfile} className="mt-4">
            <button className="rounded-full border border-hairline px-5 py-2 text-sm text-stone-700 hover:border-gold">Stop managing this profile</button>
          </form>
        </Card>
      )}

      {user.profile && (
        <Card title="Membership & verification">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-cream p-4">
              <p className="eyebrow text-gold-dark">Membership</p>
              {isPremium(user.profile) ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <PremiumBadge /> until {user.profile.premiumUntil!.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-stone-700">Free member</p>
              )}
              <Link href="/upgrade" className={`mt-2 inline-block text-sm ${linkCls}`}>{isPremium(user.profile) ? "Extend" : "Upgrade to Premium"}</Link>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="eyebrow text-gold-dark">Identity</p>
              {user.profile.idVerifiedAt ? (
                <p className="mt-2"><IdVerifiedBadge /></p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-stone-700">Not verified</p>
                  <Link href="/verify-id" className={`mt-2 inline-block text-sm ${linkCls}`}>Verify your ID</Link>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title="WhatsApp updates">
        <p className="text-sm text-stone-600">
          Get a WhatsApp message when someone sends or accepts an interest, when your profile is approved, and a weekly
          summary of new matches.
        </p>
        <form action={setWhatsappOptIn.bind(null, !user.whatsappOptIn)} className="mt-4 flex flex-wrap items-center gap-4">
          <span className={`text-sm font-medium ${user.whatsappOptIn ? "text-emerald-700" : "text-stone-500"}`}>
            {user.whatsappOptIn ? "On" : "Off"} for {user.phone}
          </span>
          <button className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30">
            {user.whatsappOptIn ? "Turn off" : "Turn on WhatsApp updates"}
          </button>
        </form>
      </Card>

      {isOwner && (
        <Card title="Family access">
          <p className="text-sm text-stone-600">
            Let a parent or sibling manage this profile with their own login — they can browse, send and accept interests
            on your behalf. Up to {MAX_FAMILY_MANAGERS} family members.
          </p>
          {(managers.length > 0 || invites.length > 0) && (
            <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {RELATIONS[m.relation]} · {m.user.phone} <span className="ml-1 text-xs text-emerald-700">active</span>
                  </span>
                  <form action={removeFamilyManager.bind(null, m.id)}>
                    <button className="text-red-700 hover:underline">Remove</button>
                  </form>
                </li>
              ))}
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {RELATIONS[i.relation]} · {i.phone} <span className="ml-1 text-xs text-amber-700">invited</span>
                  </span>
                  <form action={cancelFamilyInvite.bind(null, i.id)}>
                    <button className="text-stone-600 hover:underline">Cancel</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {managers.length + invites.length < MAX_FAMILY_MANAGERS && (
            <ActionForm action={inviteFamilyMember} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField label="Their mobile number" name="phone" type="tel" inputMode="numeric" required placeholder="98765 43210" />
              <SelectField label="Relation" name="relation" options={RELATIONS} required />
              <SubmitButton>Invite</SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      <Card title="Change password">
        <ActionForm action={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Current password" name="current" type="password" required autoComplete="current-password" />
          </div>
          <TextField label="New password" name="password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
          <TextField label="Confirm new password" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
          <div className="sm:col-span-2">
            <SubmitButton>Update password</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card title="Devices">
        <p className="text-sm text-stone-600">Signed in on a shared or lost phone? Sign out everywhere, including this device.</p>
        <form action={logoutEverywhere} className="mt-4">
          <button className="rounded-full border border-gold/60 px-5 py-2.5 text-sm text-maroon transition hover:bg-gold-light/30">
            Log out of all devices
          </button>
        </form>
      </Card>

      <Card title="Blocked members">
        {blocks.length ? (
          <ul className="divide-y divide-hairline">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {b.blocked.name} <span className="text-stone-500">· {b.blocked.code}</span>
                </span>
                <form action={unblockProfile.bind(null, b.blocked.id)}>
                  <button className="text-maroon underline decoration-gold/50 underline-offset-4 hover:decoration-gold">Unblock</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">You have not blocked anyone. Use “Block member” on a profile to stop seeing each other.</p>
        )}
      </Card>

      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-soft sm:p-7">
        <h2 className="text-2xl text-red-800">Delete account</h2>
        <p className="mt-2 text-sm text-stone-600">
          {user.isFamilyManager
            ? "Permanently deletes your login. The profile you manage is not affected."
            : "Permanently deletes your account, profile, photos, interests and shortlist. This cannot be undone."}
        </p>
        <ActionForm action={deleteAccount} confirm="Delete your account permanently? This cannot be undone." className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField label="Password" name="password" type="password" required autoComplete="current-password" />
          <TextField label="Type DELETE to confirm" name="confirmText" required pattern="DELETE" autoComplete="off" />
          <div className="sm:col-span-2">
            <SubmitButton variant="danger">Delete my account</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
