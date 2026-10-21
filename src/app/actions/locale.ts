"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

/** Saves the language choice in a cookie and, for signed-in members, on their account. */
export async function setLanguage(locale: Locale): Promise<void> {
  const value: Locale = locale === "ta" ? "ta" : "en";
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  const user = await getCurrentUser();
  if (user && user.locale !== value) await db.user.update({ where: { id: user.id }, data: { locale: value } });
}
