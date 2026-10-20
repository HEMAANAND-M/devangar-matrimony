import { NextResponse, type NextRequest } from "next/server";
import { loadConversation, markRead, toChatMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Messages newer than `?after=` for the open chat window; also marks incoming ones read. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ interestId: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  const user = await getCurrentUser();
  if (!user?.profile || !user.phoneVerified) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const me = user.profile;

  const { interestId } = await params;
  const convo = await loadConversation(interestId, me);
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });

  const afterParam = request.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  const messages = await db.message.findMany({
    where: { interestId, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (messages.some((m) => m.senderId !== me.id && !m.readAt)) await markRead(interestId, me.id);
  // Read receipts for my own earlier messages, so ticks update without reloading.
  const readUpTo = await db.message.findFirst({
    where: { interestId, senderId: me.id, readAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json(
    {
      messages: messages.map((m) => toChatMessage(m, me.id)),
      readUpTo: readUpTo?.createdAt.toISOString() ?? null,
      blocked: convo.block,
    },
    { headers: noStore },
  );
}
