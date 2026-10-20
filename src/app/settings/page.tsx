import { changePassword, deleteAccount, logoutEverywhere } from "@/app/actions/auth";
import { unblockProfile } from "@/app/actions/interactions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { TextField } from "@/components/fields";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Settings" subtitle={`Signed in as ${user.phone}`} />
      {blocked && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Member blocked. You will no longer see each other.
        </p>
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
          Permanently deletes your account, profile, photos, interests and shortlist. This cannot be undone.
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
