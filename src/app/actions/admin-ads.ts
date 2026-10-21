"use server";

import type { AdCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AD_CATEGORIES, processAdImage } from "@/lib/ads";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { requireAdmin } from "@/lib/session";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const dateOrNull = (v: string) => (v ? new Date(`${v}T00:00:00+05:30`) : null);

function revalidateAds() {
  revalidatePath("/admin/ads");
  revalidatePath("/");
}

export async function saveAd(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = str(fd, "title").slice(0, 120);
  const advertiser = str(fd, "advertiser").slice(0, 120);
  if (!title || !advertiser) return { error: "Add a title and the advertiser's name." };
  const rawCategory = str(fd, "category");
  const category = (AD_CATEGORIES as string[]).includes(rawCategory) ? (rawCategory as AdCategory) : "OTHER";
  const href = str(fd, "href");
  if (href && !/^https:\/\/[^\s]+$/.test(href)) return { error: "Links must start with https://" };
  const startsAt = dateOrNull(str(fd, "startsAt"));
  const endsAt = dateOrNull(str(fd, "endsAt"));
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "The end date must be after the start date." };
  const sortOrder = Math.max(0, Math.min(9999, Math.floor(Number(str(fd, "sortOrder") || "0")) || 0));

  let image: { image: Uint8Array<ArrayBuffer>; imageMime: string } | null = null;
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    const processed = await processAdImage(file);
    if ("error" in processed) return { error: processed.error };
    image = { image: new Uint8Array(processed.data), imageMime: "image/webp" };
  }
  const data = {
    title,
    advertiser,
    category,
    tagline: str(fd, "tagline").slice(0, 160) || null,
    href: href || null,
    active: fd.get("active") === "on",
    startsAt,
    endsAt,
    sortOrder,
  };

  if (id) {
    await db.advertisement.update({ where: { id }, data: { ...data, ...(image ?? {}) } });
    await log(admin.id, "ads.update", id, title);
  } else {
    if (!image) return { error: "Upload a banner image (1600 × 600 recommended)." };
    const ad = await db.advertisement.create({ data: { ...data, ...image } });
    await log(admin.id, "ads.create", ad.id, `${advertiser} — ${title}`);
  }
  revalidateAds();
  return { message: id ? "Advertisement saved." : "Advertisement added." };
}

export async function deleteAd(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const ad = await db.advertisement.delete({ where: { id }, select: { title: true, advertiser: true } }).catch(() => null);
  if (!ad) return { error: "Advertisement not found." };
  await log(admin.id, "ads.delete", id, `${ad.advertiser} — ${ad.title}`);
  revalidateAds();
  return { message: "Deleted." };
}

/** Swaps the ad with its neighbour in display order, renumbering so orders stay distinct. */
export async function moveAd(id: string, direction: "up" | "down"): Promise<FormState> {
  const admin = await requireAdmin();
  const ads = await db.advertisement.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
  const i = ads.findIndex((a) => a.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ads.length) return {};
  [ads[i], ads[j]] = [ads[j], ads[i]];
  await db.$transaction(ads.map((a, index) => db.advertisement.update({ where: { id: a.id }, data: { sortOrder: index * 10 } })));
  await log(admin.id, "ads.update", id, `moved ${direction}`);
  revalidateAds();
  return {};
}
