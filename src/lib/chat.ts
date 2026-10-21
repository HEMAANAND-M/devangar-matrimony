import "server-only";
import type { Photo, Profile } from "@prisma/client";
import { isBlocked } from "./access";
import { db } from "./db";
import { isPremium } from "./premium";
import { withPhotos } from "./queries";
import { featureEnabled } from "./settings";
import { looksLikeScam } from "./moderation";

export const MESSAGE_MAX = 1000;

/** Why a conversation cannot be used, or null when chatting is allowed. */
export type ChatBlock = "disabled" | "not_accepted" | "blocked" | "not_approved" | "premium";

export const CHAT_BLOCK_TEXT: Record<ChatBlock, string> = {
  disabled: "Messaging is switched off for now. Please check back later.",
  not_accepted: "You can message each other once the interest is accepted.",
  blocked: "This conversation is no longer available.",
  not_approved: "Messaging opens once both profiles are approved.",
  premium: "Messaging needs at least one of you to be a Premium member.",
};

type Party = Pick<Profile, "id" | "status" | "premiumUntil">;

export async function chatBlockReason(status: string, me: Party, other: Party): Promise<ChatBlock | null> {
  if (!(await featureEnabled("chat"))) return "disabled";
  if (status !== "ACCEPTED") return "not_accepted";
  if (await isBlocked(me.id, other.id)) return "blocked";
  if (me.status !== "APPROVED" || other.status !== "APPROVED") return "not_approved";
  if (!isPremium(me) && !isPremium(other)) return "premium";
  return null;
}

export type Conversation = {
  interestId: string;
  status: string;
  other: Profile & { photos: Photo[] };
  block: ChatBlock | null;
};

/** The conversation behind an interest, if `me` is one of its two members. */
export async function loadConversation(interestId: string, me: Party): Promise<Conversation | null> {
  const interest = await db.interest.findUnique({
    where: { id: interestId },
    include: { from: { include: withPhotos }, to: { include: withPhotos } },
  });
  if (!interest || (interest.fromId !== me.id && interest.toId !== me.id)) return null;
  const other = interest.fromId === me.id ? interest.to : interest.from;
  return { interestId: interest.id, status: interest.status, other, block: await chatBlockReason(interest.status, me, other) };
}

/** Accepted interest between two profiles, in either direction. */
export function acceptedInterestBetween(a: string, b: string) {
  return db.interest.findFirst({
    where: { status: "ACCEPTED", OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
    select: { id: true, status: true },
  });
}

/** Contact details may be shared in chat once either side has approved a phone-number request. */
export async function contactShared(a: string, b: string): Promise<boolean> {
  const hit = await db.contactRequest.findFirst({
    where: { status: "APPROVED", OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
    select: { id: true },
  });
  return !!hit;
}

/** `warning`: the other member's message reads like a common scam, so the thread shows a safety tip. */
export type ChatMessage = { id: string; body: string; mine: boolean; createdAt: string; read: boolean; warning: boolean };

export const toChatMessage = (m: { id: string; body: string; senderId: string; createdAt: Date; readAt: Date | null }, meId: string): ChatMessage => ({
  id: m.id,
  body: m.body,
  mine: m.senderId === meId,
  createdAt: m.createdAt.toISOString(),
  read: !!m.readAt,
  warning: m.senderId !== meId && looksLikeScam(m.body),
});

/** Marks the other member's messages in this conversation as read. */
export function markRead(interestId: string, meId: string) {
  return db.message.updateMany({ where: { interestId, senderId: { not: meId }, readAt: null }, data: { readAt: new Date() } });
}

/** Total unread messages across all conversations, for nav badges. */
export function unreadCount(profileId: string) {
  return db.message.count({
    where: {
      readAt: null,
      senderId: { not: profileId },
      interest: { status: "ACCEPTED", OR: [{ fromId: profileId }, { toId: profileId }] },
    },
  });
}
