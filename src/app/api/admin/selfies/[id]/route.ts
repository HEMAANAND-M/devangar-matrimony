import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/session";

/** Staff-only selfie viewer: decrypted on the fly, never cached. ID documents use the admin-only route. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const v = await db.idVerification.findUnique({ where: { id }, select: { docType: true, document: true, documentMime: true } });
  if (v?.docType !== "SELFIE" || !v.document || !v.documentMime) return new Response("Selfie already deleted", { status: 404 });

  return new Response(new Uint8Array(decrypt(Buffer.from(v.document))), {
    headers: {
      "Content-Type": v.documentMime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
