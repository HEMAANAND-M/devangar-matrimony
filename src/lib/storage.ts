import "server-only";
import { createHmac } from "node:crypto";
import { del, put } from "@vercel/blob";
import { db } from "./db";

/**
 * Where photo renditions live.
 *
 * Default: the PhotoBlob table (simple, private, fine for a few thousand photos).
 * With BLOB_READ_WRITE_TOKEN set: Vercel Blob. Blob URLs are public, so the pathname is an HMAC of
 * the photo id with a server secret: unguessable, yet derivable, so no URL needs storing. Bytes are
 * always fetched server-side and served through /api/photos/[id] with the usual access checks; the
 * blob URL never reaches a browser.
 */
export type Size = "full" | "thumb";
type Renditions = { full: Buffer; thumb: Buffer };

const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;
export const usingBlobStorage = () => !!blobToken();

function secret(): string {
  const s = process.env.PHOTO_STORAGE_KEY || process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET must be set");
  return s;
}

function pathname(photoId: string, size: Size): string {
  const digest = createHmac("sha256", secret()).update(`photo:${photoId}`).digest("hex").slice(0, 40);
  return `photos/${digest}-${size}.webp`;
}

/** Public base URL of the store: BLOB_BASE_URL, or derived from the store id inside the token. */
function blobBase(): string {
  if (process.env.BLOB_BASE_URL) return process.env.BLOB_BASE_URL.replace(/\/$/, "");
  const storeId = blobToken()?.match(/^vercel_blob_rw_([a-z\d]+)_/i)?.[1];
  if (!storeId) throw new Error("Cannot derive the Blob store URL; set BLOB_BASE_URL");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}

const blobUrl = (photoId: string, size: Size) => `${blobBase()}/${pathname(photoId, size)}`;

export async function putPhoto(photoId: string, { full, thumb }: Renditions): Promise<void> {
  if (!usingBlobStorage()) {
    await db.photoBlob.create({ data: { photoId, full: new Uint8Array(full), thumb: new Uint8Array(thumb) } });
    return;
  }
  const options = { access: "public" as const, addRandomSuffix: false, contentType: "image/webp", token: blobToken() };
  await Promise.all([
    put(pathname(photoId, "full"), full, options),
    put(pathname(photoId, "thumb"), thumb, options),
  ]);
}

export async function getPhoto(photoId: string, size: Size): Promise<Uint8Array | null> {
  if (usingBlobStorage()) {
    const res = await fetch(blobUrl(photoId, size), { cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (res?.ok) return new Uint8Array(await res.arrayBuffer());
    // Photos uploaded before Blob storage was switched on are still in the table.
  }
  const row =
    size === "thumb"
      ? await db.photoBlob.findUnique({ where: { photoId }, select: { thumb: true } })
      : await db.photoBlob.findUnique({ where: { photoId }, select: { full: true } });
  const bytes = row && ("thumb" in row ? row.thumb : row.full);
  return bytes ? new Uint8Array(bytes) : null;
}

/**
 * Removes stored renditions. Table rows go with the Photo row (cascade), so this only matters for
 * Blob storage. Call it with the ids before or after deleting the Photo rows; it never throws.
 */
export async function deletePhotos(photoIds: string[]): Promise<void> {
  if (!usingBlobStorage() || !photoIds.length) return;
  try {
    await del(photoIds.flatMap((id) => [blobUrl(id, "full"), blobUrl(id, "thumb")]), { token: blobToken() });
  } catch (e) {
    console.error("[storage] blob delete failed:", e instanceof Error ? e.message : e);
  }
}

export const deletePhoto = (photoId: string) => deletePhotos([photoId]);
