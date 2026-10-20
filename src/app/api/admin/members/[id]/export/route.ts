import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Everything held about one member, as JSON, for a data-access request (DPDP Act). Photo and
 * document bytes, password hashes and staff notes are left out; photos are listed by id.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, phone: true, email: true, role: true, status: true, phoneVerified: true, createdAt: true, lastLoginAt: true,
      whatsappOptIn: true, emailOptIn: true, locale: true, referralCode: true,
      loginEvents: { select: { createdAt: true, userAgent: true }, orderBy: { createdAt: "desc" } },
      notifications: { select: { template: true, channel: true, status: true, createdAt: true } },
      tickets: { select: { subject: true, status: true, createdAt: true, messages: { select: { body: true, fromStaff: true, createdAt: true } } } },
      managing: { select: { relation: true, profile: { select: { code: true } } } },
      profile: {
        include: {
          photos: { select: { id: true, approved: true, isPrimary: true, createdAt: true } },
          sentInterests: { select: { to: { select: { code: true } }, status: true, message: true, createdAt: true } },
          receivedInterests: { select: { from: { select: { code: true } }, status: true, message: true, createdAt: true } },
          shortlists: { select: { target: { select: { code: true } }, createdAt: true } },
          blocksMade: { select: { blocked: { select: { code: true } }, createdAt: true } },
          reportsMade: { select: { target: { select: { code: true } }, reason: true, createdAt: true } },
          viewsMade: { select: { viewed: { select: { code: true } }, viewedAt: true } },
          messagesSent: { select: { body: true, createdAt: true } },
          contactsSent: { select: { to: { select: { code: true } }, status: true, createdAt: true } },
          savedSearches: { select: { name: true, params: true, createdAt: true } },
          payments: { select: { plan: true, months: true, amount: true, status: true, paidAt: true, invoiceNumber: true } },
          idVerifications: { select: { docType: true, last4: true, status: true, createdAt: true, reviewedAt: true } },
          managers: { select: { relation: true, createdAt: true } },
        },
      },
    },
  });
  if (!user) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const { profile, ...account } = user;
  // Internal moderation data is not part of the member's own record.
  const profileData = profile && Object.fromEntries(Object.entries(profile).filter(([k]) => k !== "staffNotes" && k !== "flags"));
  await db.adminLog.create({ data: { adminId: admin.id, action: "member.export", targetId: id } });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account, profile: profileData }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="member-data-${profile?.code ?? id}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
