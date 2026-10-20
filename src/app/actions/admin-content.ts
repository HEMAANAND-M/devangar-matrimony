"use server";

import { revalidatePath } from "next/cache";
import { parseSafety, type Faq, type Testimonial } from "@/lib/content";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/form";
import { LIST_DEFAULTS, type ListKey } from "@/lib/lists";
import { requireAdmin } from "@/lib/session";
import { FEATURE_DEFAULTS, type Feature, setSetting } from "@/lib/settings";
import { processStoryPhoto } from "@/lib/story-photo";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const dateOrNull = (v: string) => (v ? new Date(`${v}T00:00:00+05:30`) : null);

// ——— Success stories ———

export async function saveStory(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const coupleNames = str(fd, "coupleNames").slice(0, 120);
  const story = str(fd, "story").slice(0, 3000);
  if (!coupleNames || story.length < 20) return { error: "Add the couple’s names and a story of at least 20 characters." };
  const file = fd.get("photo");
  let photo: { photo: Uint8Array<ArrayBuffer>; photoMime: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const processed = await processStoryPhoto(file);
    if ("error" in processed) return { error: processed.error };
    photo = { photo: new Uint8Array(processed.data), photoMime: "image/webp" };
  }
  const data = {
    coupleNames,
    story,
    city: str(fd, "city").slice(0, 60) || null,
    weddingDate: dateOrNull(str(fd, "weddingDate")),
    published: fd.get("published") === "on",
    ...(photo ?? {}),
    ...(fd.get("removePhoto") === "on" && !photo ? { photo: null, photoMime: null } : {}),
  };
  const saved = id ? await db.successStory.update({ where: { id }, data }) : await db.successStory.create({ data });
  await log(admin.id, id ? "story.update" : "story.create", saved.id, coupleNames);
  revalidatePath("/admin/content");
  revalidatePath("/stories");
  return { message: id ? "Story updated." : "Story added." };
}

export async function setStoryPublished(id: string, published: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  await db.successStory.update({ where: { id }, data: { published } });
  await log(admin.id, published ? "story.publish" : "story.unpublish", id);
  revalidatePath("/admin/content");
  revalidatePath("/stories");
  return { message: published ? "Published" : "Unpublished" };
}

export async function deleteStory(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  await db.successStory.delete({ where: { id } });
  await log(admin.id, "story.delete", id);
  revalidatePath("/admin/content");
  revalidatePath("/stories");
  return { message: "Deleted" };
}

// ——— Page content ———

/** Reads repeated form rows named `<field>_<i>` for i < count, skipping rows whose first field is empty. */
function rows<K extends string>(fd: FormData, fields: K[]): Record<K, string>[] {
  const count = Number(str(fd, "count")) || 0;
  const out: Record<K, string>[] = [];
  for (let i = 0; i < count; i++) {
    const row = Object.fromEntries(fields.map((f) => [f, str(fd, `${f}_${i}`)])) as Record<K, string>;
    if (row[fields[0]]) out.push(row);
  }
  return out;
}

export async function saveFaq(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const faq: Faq[] = rows(fd, ["q", "a"]).map((r) => ({ q: r.q.slice(0, 200), a: r.a.slice(0, 1500) }));
  if (faq.some((f) => !f.a)) return { error: "Every question needs an answer." };
  await setSetting("content.faq", faq);
  await log(admin.id, "content.faq", "content.faq", `${faq.length} questions`);
  revalidatePath("/faq");
  revalidatePath("/admin/content");
  return { message: "FAQ saved." };
}

export async function saveTestimonials(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const list: Testimonial[] = rows(fd, ["quote", "names", "city"]).map((r) => ({
    quote: r.quote.slice(0, 500),
    names: r.names.slice(0, 80),
    city: r.city.slice(0, 60) || undefined,
  }));
  if (list.some((t) => !t.names)) return { error: "Every testimonial needs the family’s names." };
  await setSetting("content.testimonials", list);
  await log(admin.id, "content.testimonials", "content.testimonials", `${list.length} testimonials`);
  revalidatePath("/");
  revalidatePath("/admin/content");
  return { message: "Testimonials saved." };
}

export async function saveSafety(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const sections = parseSafety(str(fd, "text"));
  if (!sections.length) return { error: "Add at least one section: a “## Title” line followed by points." };
  await setSetting("content.safety", sections);
  await log(admin.id, "content.safety", "content.safety", `${sections.length} sections`);
  revalidatePath("/safety");
  revalidatePath("/admin/content");
  return { message: "Safety page saved." };
}

// ——— Events ———

export async function saveEvent(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = str(fd, "title").slice(0, 120);
  const description = str(fd, "description").slice(0, 2000);
  const location = str(fd, "location").slice(0, 160);
  const starts = str(fd, "startsAt");
  if (!title || !description || !location || !starts) return { error: "Title, description, location and start time are required." };
  const startsAt = new Date(`${starts}:00+05:30`);
  const ends = str(fd, "endsAt");
  const endsAt = ends ? new Date(`${ends}:00+05:30`) : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) return { error: "Enter valid dates." };
  if (endsAt && endsAt < startsAt) return { error: "The event cannot end before it starts." };
  const href = str(fd, "href");
  if (href && !/^https:\/\//.test(href)) return { error: "Links must start with https://" };
  const data = { title, description, location, startsAt, endsAt, href: href || null, published: fd.get("published") === "on" };
  const saved = id ? await db.event.update({ where: { id }, data }) : await db.event.create({ data });
  await log(admin.id, id ? "event.update" : "event.create", saved.id, title);
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { message: id ? "Event updated." : "Event added." };
}

export async function deleteEvent(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  await db.event.delete({ where: { id } });
  await log(admin.id, "event.delete", id);
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { message: "Deleted" };
}

// ——— Settings ———

export async function saveLists(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const lists = Object.fromEntries(
    (Object.keys(LIST_DEFAULTS) as ListKey[]).map((key) => {
      const items = str(fd, key)
        .split(/\r?\n/)
        .map((s) => s.trim().slice(0, 80))
        .filter(Boolean);
      return [key, [...new Set(items)]];
    }),
  ) as Record<ListKey, string[]>;
  const empty = (Object.keys(lists) as ListKey[]).find((k) => !lists[k].length);
  if (empty) return { error: `The ${empty} list cannot be empty.` };
  await setSetting("lists", lists);
  await log(admin.id, "settings.lists", "lists");
  revalidatePath("/", "layout");
  return { message: "Dropdown lists saved." };
}

export async function saveFeatures(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const flags = Object.fromEntries((Object.keys(FEATURE_DEFAULTS) as Feature[]).map((k) => [k, fd.get(k) === "on"]));
  await setSetting("features", flags);
  const off = Object.entries(flags).filter(([, v]) => !v).map(([k]) => k);
  await log(admin.id, "settings.features", "features", off.length ? `off: ${off.join(", ")}` : "all on");
  revalidatePath("/", "layout");
  return { message: "Feature switches saved." };
}
