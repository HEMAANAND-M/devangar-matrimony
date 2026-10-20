import "server-only";

type Cell = string | number | boolean | Date | null | undefined;

/**
 * RFC 4180 CSV with a UTF-8 BOM so Excel shows Tamil names correctly. Cells starting with
 * = + - @ are prefixed with ' so a spreadsheet never executes member-supplied text as a formula.
 */
export function toCsv(header: string[], rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(body: string, name: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const forbidden = () => new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
