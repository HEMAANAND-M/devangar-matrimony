"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { requireProfile } from "@/lib/session";
import { processStoryPhoto } from "@/lib/story-photo";

/** Members share their story; it stays unpublished until an admin reviews it. */
export async function submitStory(_: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireProfile();
  if (!(await rateLimitAll([[`story:${user.id}`, 3, 24 * HOUR]]))) return { error: RATE_LIMITED };
  const coupleNames = str(fd, "coupleNames").slice(0, 120);
  const story = str(fd, "story").slice(0, 3000);
  if (!coupleNames) return { error: "Tell us the couple’s names." };
  if (story.length < 40) return { error: "Please write a few lines about how you met (at least 40 characters)." };
  const file = fd.get("photo");
  let photo: { photo: Uint8Array<ArrayBuffer>; photoMime: string } | undefined;
  if (file instanceof File && file.size > 0) {
    const processed = await processStoryPhoto(file);
    if ("error" in processed) return { error: processed.error };
    photo = { photo: new Uint8Array(processed.data), photoMime: "image/webp" };
  }
  const wedding = str(fd, "weddingDate");
  await db.successStory.create({
    data: {
      coupleNames,
      story,
      city: str(fd, "city").slice(0, 60) || profile.city,
      weddingDate: wedding ? new Date(`${wedding}T00:00:00+05:30`) : null,
      profileId: profile.id,
      ...photo,
    },
  });
  revalidatePath("/admin/content");
  return { message: "Thank you! Our team will review your story and publish it soon." };
}
