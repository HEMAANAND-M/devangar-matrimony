"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { HOUR, RATE_LIMITED, rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

const emailSchema = z.email().max(254);

/** Saves the account's email address; an empty value removes it (and turns email updates off). */
export async function setEmail(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit(`prefs:email:${user.id}`, 10, HOUR))) return { error: RATE_LIMITED };
  const raw = str(fd, "email").toLowerCase();
  if (!raw) {
    await db.user.update({ where: { id: user.id }, data: { email: null, emailOptIn: false } });
    revalidatePath("/settings");
    return { message: "Email removed." };
  }
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (parsed.data === user.email) return { message: "Email saved." };
  const taken = await db.user.findFirst({ where: { email: parsed.data, id: { not: user.id } }, select: { id: true } });
  if (taken) return { error: "That email is already used by another account." };
  await db.user.update({ where: { id: user.id }, data: { email: parsed.data } });
  revalidatePath("/settings");
  return { message: "Email saved." };
}

export async function setEmailOptIn(optIn: boolean): Promise<FormState> {
  const user = await requireUser();
  if (optIn && !user.email) return { error: "Add your email address first." };
  await db.user.update({ where: { id: user.id }, data: { emailOptIn: optIn } });
  revalidatePath("/settings");
  return { message: optIn ? "Email updates turned on." : "Email updates turned off." };
}
