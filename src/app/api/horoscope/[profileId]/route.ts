import { db } from "@/lib/db";
import { canViewHoroscope } from "@/lib/horoscope";
import { getCurrentUser, isStaff } from "@/lib/session";

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const target = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, code: true, status: true, gender: true, horoscopeVisibility: true },
  });
  if (!target) return NOT_FOUND();
  const allowed = await canViewHoroscope(target, { profileId: user.profile?.id, gender: user.profile?.gender, isStaff: isStaff(user) });
  if (!allowed) return NOT_FOUND();

  const file = await db.horoscope.findUnique({ where: { profileId } });
  if (!file) return NOT_FOUND();

  const download = new URL(request.url).searchParams.get("download") === "1";
  const ext = file.mime === "application/pdf" ? "pdf" : "webp";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="horoscope-${target.code}.${ext}"`,
      // Access is re-checked on every request; nothing is kept for the next person on a shared browser.
      "Cache-Control": "private, no-cache",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      // Rendered PDFs and images cannot run scripts or reach our origin.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
