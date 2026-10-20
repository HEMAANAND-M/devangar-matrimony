import { setEmail, setEmailOptIn } from "@/app/actions/prefs";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "./ActionForm";
import { Card } from "./Card";
import { TextField } from "./fields";

/** Email address and email-notification opt-in. Placed on the settings page next to WhatsApp. */
export async function NotificationPrefs({ userId }: { userId: string }) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailOptIn: true } });
  if (!user) return null;
  return (
    <Card title="Email updates">
      <p className="text-sm text-stone-600">
        Get an email for new interests, messages, phone number requests and replies from our team. We never share your
        email with other members.
      </p>
      <ActionForm action={setEmail} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextField label="Email address" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={user.email ?? ""} placeholder="you@example.com" />
        <SubmitButton variant="secondary">Save email</SubmitButton>
      </ActionForm>
      {user.email && (
        <ActionForm action={setEmailOptIn.bind(null, !user.emailOptIn)} className="mt-4 flex flex-wrap items-center gap-4">
          <span className={`text-sm font-medium ${user.emailOptIn ? "text-emerald-700" : "text-stone-500"}`}>
            {user.emailOptIn ? "On" : "Off"} for {user.email}
          </span>
          <SubmitButton variant={user.emailOptIn ? "secondary" : "primary"}>{user.emailOptIn ? "Turn off" : "Turn on email updates"}</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
