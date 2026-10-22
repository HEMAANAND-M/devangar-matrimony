"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { HOUR, RATE_LIMITED, rateLimitAll } from "@/lib/rate-limit";
import { MAX_FAMILY_MANAGERS } from "@/lib/family";
import { requireUser } from "@/lib/session";
import { tm } from "@/lib/i18n";
import { phoneFields, phoneHash } from "@/lib/field-crypto";

const RELATIONS = ["FATHER", "MOTHER", "BROTHER", "SISTER", "GUARDIAN", "OTHER"] as const;
const INVITE_DAYS = 7;

/** Only the profile's own account may grant or revoke family access. */
async function requireOwner() {
  const user = await requireUser();
  if (!user.profile || user.isFamilyManager) redirect("/settings");
  return { user, profile: user.profile };
}

export async function inviteFamilyMember(_: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireOwner();
  if (!(await rateLimitAll([[`family-invite:${user.id}`, 10, 24 * HOUR]]))) return { error: await tm(RATE_LIMITED) };

  const phone = normalizePhone(str(fd, "phone"));
  const relation = str(fd, "relation") as (typeof RELATIONS)[number];
  if (!phone) return { error: await tm("Enter a valid 10-digit Indian mobile number.") };
  if (!RELATIONS.includes(relation)) return { error: await tm("Choose how they are related to you.") };
  if (phone === user.phone) return { error: await tm("That is your own number.") };

  const [managers, invites] = await Promise.all([
    db.profileManager.count({ where: { profileId: profile.id } }),
    db.familyInvite.count({ where: { profileId: profile.id, expiresAt: { gt: new Date() } } }),
  ]);
  if (managers + invites >= MAX_FAMILY_MANAGERS) return { error: await tm(`Up to ${MAX_FAMILY_MANAGERS} family members can manage a profile.`) };

  await db.familyInvite.upsert({
    where: { profileId_phoneHash: { profileId: profile.id, phoneHash: phoneHash(phone) } },
    create: { profileId: profile.id, ...phoneFields(phone), relation, expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * HOUR) },
    update: { relation, expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * HOUR) },
  });
  revalidatePath("/settings");
  return { message: await tm(`Invitation created. Ask them to register or log in with ${phone} within ${INVITE_DAYS} days to accept.`) };
}

export async function cancelFamilyInvite(inviteId: string) {
  const { profile } = await requireOwner();
  await db.familyInvite.deleteMany({ where: { id: inviteId, profileId: profile.id } });
  revalidatePath("/settings");
}

export async function removeFamilyManager(managerId: string) {
  const { profile } = await requireOwner();
  await db.profileManager.deleteMany({ where: { id: managerId, profileId: profile.id } });
  revalidatePath("/settings");
}

/** The invitee's phone was verified by OTP at registration, which is what binds the invite to them. */
export async function acceptFamilyInvite(inviteId: string) {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");
  const invite = await db.familyInvite.findFirst({ where: { id: inviteId, phoneHash: user.phoneHash, expiresAt: { gt: new Date() } } });
  if (!invite) redirect("/profile/edit");
  const managers = await db.profileManager.count({ where: { profileId: invite.profileId } });
  if (managers >= MAX_FAMILY_MANAGERS) redirect("/profile/edit?family=full");

  await db.$transaction([
    db.profileManager.create({ data: { profileId: invite.profileId, userId: user.id, relation: invite.relation } }),
    db.familyInvite.delete({ where: { id: invite.id } }),
  ]);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function declineFamilyInvite(inviteId: string) {
  const user = await requireUser();
  await db.familyInvite.deleteMany({ where: { id: inviteId, phoneHash: user.phoneHash } });
  revalidatePath("/profile/edit");
}

export async function leaveManagedProfile() {
  const user = await requireUser();
  await db.profileManager.deleteMany({ where: { userId: user.id } });
  revalidatePath("/", "layout");
  redirect("/profile/edit");
}
