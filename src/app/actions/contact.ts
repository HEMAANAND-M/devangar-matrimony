"use server";

import { revalidatePath } from "next/cache";
import { acceptedInterestBetween } from "@/lib/chat";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { link, notifyProfile } from "@/lib/notify";
import { isPremium } from "@/lib/premium";
import { browsableWhere } from "@/lib/queries";
import { HOUR, RATE_LIMITED, rateLimit } from "@/lib/rate-limit";
import { requireProfile } from "@/lib/session";
import { featureEnabled } from "@/lib/settings";

/**
 * Asks to see a member's phone number. Requires an accepted interest (they already chose to
 * connect) and Premium (seeing contact numbers is the main Premium benefit). The number is only
 * shown once they approve.
 */
export async function requestContact(targetId: string): Promise<FormState> {
  const { profile } = await requireProfile();
  if (!(await featureEnabled("contactRequests"))) return { error: "Phone number requests are switched off for now." };
  if (profile.status !== "APPROVED") return { error: "You can request contact details once your profile is approved." };
  if (!isPremium(profile)) return { error: "Upgrade to Premium to request phone numbers." };

  const target = await db.profile.findFirst({ where: { ...browsableWhere(profile), id: targetId }, select: { id: true, name: true, code: true } });
  if (!target) return { error: "This profile is not available." };
  if (!(await acceptedInterestBetween(profile.id, target.id))) {
    return { error: "You can request a phone number once your interest is accepted." };
  }
  if (!(await rateLimit(`contact:${profile.id}`, 20, 24 * HOUR))) return { error: RATE_LIMITED };

  const existing = await db.contactRequest.findUnique({ where: { fromId_toId: { fromId: profile.id, toId: target.id } } });
  if (existing?.status === "APPROVED") return { message: "They have already shared their number with you." };
  if (existing?.status === "PENDING") return { message: "Request already sent. We'll let you know when they respond." };
  if (existing?.status === "DECLINED") return { error: "This member prefers to keep their number private for now. You can keep chatting in Messages." };

  await db.contactRequest.create({ data: { fromId: profile.id, toId: target.id } });
  await notifyProfile(target.id, "contact_request", { name: target.name.split(" ")[0], fromCode: profile.code, link: link("/interests") });
  revalidatePath(`/profiles/${target.code}`);
  return { message: "Request sent. Their number will appear here once they approve." };
}

export async function respondContact(requestId: string, approve: boolean): Promise<FormState> {
  const { profile } = await requireProfile();
  const updated = await db.contactRequest.updateMany({
    where: { id: requestId, toId: profile.id, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "DECLINED", respondedAt: new Date() },
  });
  if (!updated.count) return { error: "This request has already been answered." };
  if (approve) {
    const request = await db.contactRequest.findUnique({ where: { id: requestId }, include: { from: { select: { id: true, name: true } } } });
    if (request) {
      await notifyProfile(request.from.id, "contact_approved", {
        name: request.from.name.split(" ")[0],
        byCode: profile.code,
        link: link(`/profiles/${profile.code}`),
      });
    }
  }
  revalidatePath("/interests");
  return { message: approve ? "Number shared." : "Request declined." };
}
