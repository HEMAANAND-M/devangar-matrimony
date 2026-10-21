"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { type FormState, str } from "@/lib/form";
import { link, notifyProfile, notifyUser } from "@/lib/notify";
import { HOUR, RATE_LIMITED, clientIp, rateLimitAll } from "@/lib/rate-limit";
import { getCurrentUser, isStaff, requireStaff, requireUser } from "@/lib/session";
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";

function log(adminId: string, action: string, targetId: string, detail?: string) {
  return db.adminLog.create({ data: { adminId, action, targetId, detail } });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createTicket(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const ip = await clientIp();
  if (!(await rateLimitAll([[`ticket:ip:${ip}`, 5, HOUR], ...(user ? ([[`ticket:user:${user.id}`, 5, HOUR]] as [string, number, number][]) : [])]))) {
    return { error: RATE_LIMITED };
  }
  if (!user && !(await verifyTurnstile(fd))) return { error: TURNSTILE_FAILED };
  const subject = str(fd, "subject").slice(0, 140);
  const body = str(fd, "message").slice(0, 4000);
  if (!subject || body.length < 10) return { error: "Add a subject and describe how we can help (at least 10 characters)." };

  let name = str(fd, "name").slice(0, 80);
  let phone: string | null = null;
  let email = str(fd, "email").slice(0, 120) || null;
  if (user) {
    name ||= user.profile?.name ?? user.phone;
    phone = user.phone;
    email ||= user.email;
  } else {
    if (!name) return { error: "Tell us your name." };
    phone = str(fd, "phone") ? normalizePhone(str(fd, "phone")) : null;
    if (str(fd, "phone") && !phone) return { error: "Enter a valid 10-digit mobile number." };
    if (email && !EMAIL.test(email)) return { error: "Enter a valid email address." };
    if (!phone && !email) return { error: "Give a mobile number or email so we can reply." };
  }

  const ticket = await db.supportTicket.create({
    data: { userId: user?.id ?? null, name, phone, email, subject, messages: { create: { authorId: user?.id ?? null, body } } },
  });
  revalidatePath("/admin/support");
  if (user) return { redirect: `/support/${ticket.id}` };
  return { message: "Thank you — we have received your message and will reply within one working day." };
}

/** A member replying on their own ticket re-opens it for staff. */
export async function replyToTicket(ticketId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimitAll([[`ticket:reply:${user.id}`, 20, HOUR]]))) return { error: RATE_LIMITED };
  const body = str(fd, "message").slice(0, 4000);
  if (!body) return { error: "Write a message." };
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.userId !== user.id) return { error: "Ticket not found." };
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId, authorId: user.id, body } }),
    db.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN" } }),
  ]);
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { message: "Reply sent." };
}

export async function staffReply(ticketId: string, _: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const body = str(fd, "message").slice(0, 4000);
  if (!body) return { error: "Write a reply." };
  const status = str(fd, "status") === "RESOLVED" ? "RESOLVED" : "PENDING";
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, include: { user: { select: { profile: { select: { id: true, name: true } } } } } });
  if (!ticket) return { error: "Ticket not found." };
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId, authorId: staff.id, fromStaff: true, body } }),
    db.supportTicket.update({ where: { id: ticketId }, data: { status } }),
  ]);
  await log(staff.id, "support.reply", ticketId, status.toLowerCase());
  const profile = ticket.user?.profile;
  const params = { name: (profile?.name ?? ticket.name).split(" ")[0], subject: ticket.subject, link: link(`/support/${ticketId}`) };
  if (profile) await notifyProfile(profile.id, "ticket_reply", params);
  // Signed-in members without a profile yet are notified on their own account.
  else if (ticket.userId) await notifyUser(ticket.userId, "ticket_reply", params);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/support/${ticketId}`);
  return { message: status === "RESOLVED" ? "Reply sent and ticket resolved." : "Reply sent." };
}

export async function setTicketStatus(ticketId: string, status: "OPEN" | "PENDING" | "RESOLVED"): Promise<FormState> {
  const user = await requireUser();
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  // Members may close their own tickets; staff may set any status.
  if (!ticket || (!isStaff(user) && (ticket.userId !== user.id || status !== "RESOLVED"))) return { error: "Not allowed." };
  await db.supportTicket.update({ where: { id: ticketId }, data: { status } });
  if (isStaff(user)) await log(user.id, "support.status", ticketId, status.toLowerCase());
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/support/${ticketId}`);
  return { message: status === "RESOLVED" ? "Marked resolved" : `Marked ${status.toLowerCase()}` };
}
