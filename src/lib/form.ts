export type FormState = { error?: string; message?: string };

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Empty string -> undefined, so optional zod fields stay optional. */
export function opt(fd: FormData, key: string): string | undefined {
  return str(fd, key) || undefined;
}
