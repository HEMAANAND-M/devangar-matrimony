import { actionLabel } from "@/app/admin/activity/labels";
import { type ActivityParams, activityWhere } from "@/app/admin/activity/query";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { csvResponse, forbidden, toCsv } from "../csv";

/** Admin-only CSV of the staff activity log, honouring the page's filters. */
export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return forbidden();
  const params: ActivityParams = Object.fromEntries(new URL(request.url).searchParams);
  const entries = await db.adminLog.findMany({
    where: activityWhere(params),
    include: { admin: { select: { phone: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });
  await db.adminLog.create({ data: { adminId: admin.id, action: "export.activity", targetId: "activity", detail: `${entries.length} rows` } });
  const csv = toCsv(
    ["When", "Staff", "Role", "Action", "Action key", "Target id", "Detail"],
    entries.map((e) => [e.createdAt, maskPhone(e.admin.phone), e.admin.role, actionLabel(e.action), e.action, e.targetId, e.detail]),
  );
  return csvResponse(csv, "activity-log");
}
