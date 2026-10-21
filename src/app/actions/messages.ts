"use server";

import { CHAT_BLOCK_TEXT, type ChatMessage, MESSAGE_MAX, contactShared, loadConversation, toChatMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { findContactInfo, looksLikeScam } from "@/lib/moderation";
import { link, notifyProfile } from "@/lib/notify";
import { MINUTE, rateLimit } from "@/lib/rate-limit";
import { requireProfile } from "@/lib/session";

export type SendResult = { error?: string; sent?: ChatMessage };

export async function sendMessage(interestId: string, raw: string): Promise<SendResult> {
  const { profile } = await requireProfile();
  const body = String(raw ?? "").trim();
  if (!body) return { error: "Type a message first." };
  if (body.length > MESSAGE_MAX) return { error: `Messages can be up to ${MESSAGE_MAX} characters.` };

  const convo = await loadConversation(interestId, profile);
  if (!convo) return { error: "This conversation is not available." };
  if (convo.block) return { error: CHAT_BLOCK_TEXT[convo.block] };
  if (!(await rateLimit(`chat:${profile.id}`, 30, MINUTE))) return { error: "You are sending messages too quickly. Please slow down." };

  // Same rule as interests: numbers and handles are exchanged through a contact request, so a
  // member always gets to approve who has their phone number.
  const found = findContactInfo(body);
  if (found && !(await contactShared(profile.id, convo.other.id))) {
    return { error: `Please don't share ${found} in chat yet. Use "Request phone number" on their profile — they can approve it.` };
  }

  const message = await db.message.create({ data: { interestId, senderId: profile.id, body } });
  // Delivered as normal, but staff see a flag on the sender's record.
  if (looksLikeScam(body) && !profile.flags.includes("scam_language")) {
    await db.profile.update({ where: { id: profile.id }, data: { flags: { push: "scam_language" } } });
  }

  // At most one alert per conversation every 30 minutes, so an active chat doesn't flood WhatsApp.
  if (await rateLimit(`notify:chat:${interestId}:${convo.other.id}`, 1, 30 * MINUTE)) {
    await notifyProfile(convo.other.id, "message_received", {
      name: convo.other.name.split(" ")[0],
      fromCode: profile.code,
      link: link(`/messages/${interestId}`),
    });
  }
  // No revalidatePath: it would make Next re-render the whole thread page on every send.
  // The conversation list is a dynamic page, so it is fresh on the next visit anyway.
  return { sent: toChatMessage(message, profile.id) };
}
