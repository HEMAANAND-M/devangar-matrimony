import Link from "next/link";
import { redirect } from "next/navigation";
import { resendStaffOtp, verifyStaffLogin } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AuthShell, authLinkCls } from "@/components/AuthShell";
import { inputCls } from "@/components/fields";
import { ResendCodeButton } from "@/components/ResendCodeButton";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/format";
import { resendWaitSeconds } from "@/lib/otp";
import { readStaffPending } from "@/lib/session";

export const metadata = { title: "Staff sign-in", robots: { index: false } };

export default async function StaffCodePage() {
  const userId = await readStaffPending();
  const user = userId ? await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } }) : null;
  if (!user) redirect("/login");
  const wait = await resendWaitSeconds(user.id, "staff_login");
  return (
    <AuthShell eyebrow="Staff sign-in · step 2" title="Enter your security code" subtitle={`For your security, staff sign-in needs the 6-digit code we sent to ${maskPhone(user.phone)}.`}>
      <ActionForm action={verifyStaffLogin} className="space-y-5">
        <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
          Security code
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            autoComplete="one-time-code"
            placeholder="••••••"
            className={`${inputCls} text-center font-display text-3xl tracking-[0.6em]`}
          />
        </label>
        <SubmitButton className="w-full py-3.5">Sign in</SubmitButton>
      </ActionForm>
      <div className="mt-8 space-y-4 border-t border-hairline pt-6 text-center text-sm text-stone-600">
        <ResendCodeButton action={resendStaffOtp} initialWait={wait} />
        <p>
          Not you? <Link href="/login" className={authLinkCls}>Use a different account</Link>
        </p>
        <p className="text-xs text-stone-500">Staff sessions end after 30 minutes without activity.</p>
      </div>
    </AuthShell>
  );
}
