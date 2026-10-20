import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Admin-only, decrypted on the fly, never cached. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const { id } = await params;
  const v = await db.idVerification.findUnique({ where: { id }, select: { document: true, documentMime: true, docType: true } });
  if (!v?.document || !v.documentMime) return new Response("Document already deleted", { status: 404 });

  const bytes = decrypt(Buffer.from(v.document));
  const isPdf = v.documentMime === "application/pdf";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": v.documentMime,
      // PDFs are downloaded rather than rendered in the site's origin.
      "Content-Disposition": isPdf ? `attachment; filename="id-${id}.pdf"` : "inline",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
