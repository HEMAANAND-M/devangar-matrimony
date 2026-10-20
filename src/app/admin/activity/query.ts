import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ActivityParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** AdminLog filter shared by the activity page and its CSV export. */
export function activityWhere(params: ActivityParams): Prisma.AdminLogWhereInput {
  const staff = one(params.staff);
  const group = one(params.group);
  const from = one(params.from);
  const to = one(params.to);
  const q = one(params.q);
  return {
    ...(staff ? { adminId: staff } : {}),
    ...(group ? { action: { startsWith: group } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
          },
        }
      : {}),
    ...(q ? { OR: [{ targetId: { contains: q } }, { detail: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
}

/**
 * Maps AdminLog target ids (user, profile, photo or report ids) to the member they concern,
 * so the log can link to the member page.
 */
export async function resolveTargets(targetIds: string[]) {
  const ids = [...new Set(targetIds)];
  if (!ids.length) return new Map<string, { userId: string; code: string | null; name: string | null }>();
  const [users, profiles, photos, reports] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, profile: { select: { code: true, name: true } } } }),
    db.profile.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, code: true, name: true } }),
    db.photo.findMany({ where: { id: { in: ids } }, select: { id: true, profile: { select: { userId: true, code: true, name: true } } } }),
    db.report.findMany({ where: { id: { in: ids } }, select: { id: true, target: { select: { userId: true, code: true, name: true } } } }),
  ]);
  const map = new Map<string, { userId: string; code: string | null; name: string | null }>();
  for (const u of users) map.set(u.id, { userId: u.id, code: u.profile?.code ?? null, name: u.profile?.name ?? null });
  for (const p of profiles) map.set(p.id, { userId: p.userId, code: p.code, name: p.name });
  for (const p of photos) map.set(p.id, { userId: p.profile.userId, code: p.profile.code, name: p.profile.name });
  for (const r of reports) map.set(r.id, { userId: r.target.userId, code: r.target.code, name: r.target.name });
  return map;
}
