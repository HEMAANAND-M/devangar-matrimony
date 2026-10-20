import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime check: 200 when the app and database answer, 503 otherwise. No details are exposed. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up" }, { headers });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers });
  }
}
