import { type MemberParams, memberSelect, memberWhere } from "@/app/admin/members/query";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { csvResponse, forbidden, toCsv } from "../csv";

const MAX_ROWS = 20_000;

/** Admin-only CSV of the members list, honouring the same filters as the page. */
export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return forbidden();
  const params: MemberParams = Object.fromEntries(new URL(request.url).searchParams);
  const members = await db.user.findMany({ where: memberWhere(params), select: memberSelect, orderBy: { createdAt: "desc" }, take: MAX_ROWS });
  await db.adminLog.create({
    data: { adminId: admin.id, action: "export.members", targetId: "members", detail: `${members.length} rows · ${new URLSearchParams(params as Record<string, string>)}` },
  });
  const csv = toCsv(
    ["Profile code", "Name", "Phone", "Email", "Gender", "Date of birth", "City", "Profile status", "Account status", "Premium until", "ID verified", "Flags", "Joined", "Last sign-in"],
    members.map((m) => [
      m.profile?.code ?? (m.managing ? `manager of ${m.managing.profile.code}` : ""),
      m.profile?.name,
      m.phone,
      m.email,
      m.profile?.gender,
      m.profile?.dateOfBirth.toISOString().slice(0, 10),
      m.profile?.city,
      m.profile?.status ?? "NO_PROFILE",
      m.status,
      m.profile?.premiumUntil?.toISOString().slice(0, 10),
      m.profile?.idVerifiedAt ? "yes" : "no",
      m.profile?.flags.join(" "),
      m.createdAt,
      m.lastLoginAt,
    ]),
  );
  return csvResponse(csv, "members");
}
