/**
 * `redirect` asks the browser for a full page load instead of a client-side transition. Used when
 * the signed-in account changes, so no page cached for the previous session can be shown.
 */
export type FormState = { error?: string; message?: string; redirect?: string };

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Empty string -> undefined, so optional zod fields stay optional. */
export function opt(fd: FormData, key: string): string | undefined {
  return str(fd, key) || undefined;
}
