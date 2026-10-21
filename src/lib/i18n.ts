import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { en } from "@/i18n/en";
import { ta } from "@/i18n/ta";
import { getCurrentUser } from "./session";

export type Locale = "en" | "ta";
export type TKey = keyof typeof en;
export type TVars = Record<string, string | number>;
export type T = (key: TKey, vars?: TVars) => string;

export const LOCALE_COOKIE = "dm_lang";
const DICTS: Record<Locale, Record<TKey, string>> = { en, ta };

/** The visitor's language: the dm_lang cookie, else a signed-in member's saved choice, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (value === "ta" || value === "en") return value;
  const user = await getCurrentUser();
  return user?.locale === "ta" ? "ta" : "en";
});

export function translate(locale: Locale, key: TKey, vars?: TVars): string {
  const text = DICTS[locale][key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

export async function getT(): Promise<T> {
  const locale = await getLocale();
  return (key, vars) => translate(locale, key, vars);
}

/*
 * Phrase keys translate English text produced elsewhere (action messages, match reasons, list
 * values) by matching the English wording. Phrases with {placeholders} match as patterns, so
 * "Only 4 of 10 poruthams match" finds "Only {score} of {total} poruthams match".
 */
const PHRASE_PREFIXES = ["msg.", "match.", "complete.", "val.", "benefit."];
const phraseKeys = (Object.keys(en) as TKey[]).filter((k) => PHRASE_PREFIXES.some((p) => k.startsWith(p)));
const EXACT = new Map(phraseKeys.filter((k) => !en[k].includes("{")).map((k) => [en[k] as string, k]));
const PATTERNS = phraseKeys
  .filter((k) => en[k].includes("{"))
  .map((k) => {
    const names: string[] = [];
    const source = en[k]
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) {
          names.push(m[1]);
          return "(.+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { key: k, names, re: new RegExp(`^${source}$`) };
  });

export function translateText(locale: Locale, text: string): string {
  if (locale === "en" || !text) return text;
  const key = EXACT.get(text);
  if (key) return translate(locale, key);
  for (const { key: k, names, re } of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    // Captured values that are themselves known phrases ("phone numbers", "Rohini") are translated too.
    const vars = names.map((n, i) => [n, EXACT.has(m[i + 1]) ? translate(locale, EXACT.get(m[i + 1])!) : m[i + 1]]);
    return translate(locale, k, Object.fromEntries(vars));
  }
  return text;
}

/** Translator for English phrases from libraries and data lists; unknown text passes through. */
export async function getTx(): Promise<(text: string) => string> {
  const locale = await getLocale();
  return (text) => translateText(locale, text);
}

/** Translates an action message into the visitor's language when a translation exists. */
export async function tm(message: string): Promise<string> {
  return translateText(await getLocale(), message);
}
