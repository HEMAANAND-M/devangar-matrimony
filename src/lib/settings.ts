import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Admin-editable configuration stored in the SiteSetting table. Keys in use:
 *   "plans"            premium plan list (see lib/premium.ts)
 *   "lists"            dropdown options: gothrams, subSects, cities, education, occupations
 *   "features"         feature switches (see FEATURE_DEFAULTS)
 *   "content.faq"      [{ q, a }]
 *   "content.safety"   markdown-ish text for the safety page
 *   "content.testimonials" [{ quote, names, city }]
 * Values are read once per request.
 */
const loadAll = cache(async () => {
  const rows = await db.siteSetting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
});

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const value = (await loadAll()).get(key);
  return value === undefined || value === null ? fallback : (value as T);
}

export async function setSetting(key: string, value: unknown) {
  const json = value as Prisma.InputJsonValue;
  await db.siteSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

export const FEATURE_DEFAULTS = {
  payments: true,
  whatsapp: true,
  email: true,
  idVerification: true,
  photoVerification: true,
  chat: true,
  contactRequests: true,
  registrations: true,
} as const;
export type Feature = keyof typeof FEATURE_DEFAULTS;

export async function featureEnabled(feature: Feature): Promise<boolean> {
  const flags = await getSetting<Partial<Record<Feature, boolean>>>("features", {});
  return flags[feature] ?? FEATURE_DEFAULTS[feature];
}
