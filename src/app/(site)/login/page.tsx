import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { TextField } from "@/components/fields";
import { getCurrentUser, homePath } from "@/lib/session";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user, !!user.profile));
  return (
    <AuthShell eyebrow="Member login" title="Welcome back" subtitle="Log in to continue your search.">
      <ActionForm action={login} className="space-y-5">
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" placeholder="98765 43210" required autoComplete="tel" />
        <TextField label="Password" name="password" type="password" required autoComplete="current-password" />
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-stone-600 hover:text-maroon">Forgot password?</Link>
        </p>
        <SubmitButton className="w-full py-3.5">Log in</SubmitButton>
      </ActionForm>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        New here? <Link href="/register" className={authLinkCls}>Register free</Link>
      </p>
      <p className="mt-3 text-center text-xs text-stone-500">
        Trouble signing in? <Link href="/support" className="underline decoration-gold/50 underline-offset-4 hover:text-maroon">Contact support</Link>
      </p>
    </AuthShell>
  );
}
