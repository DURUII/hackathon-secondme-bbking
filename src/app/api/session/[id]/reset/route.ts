import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = (await ctx.params).id;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { clearVotes?: unknown } | null;
    const clearVotes = body?.clearVotes === false ? false : true;

    const session = await db.debateSession.findUnique({
      where: { id: sessionId },
      select: { id: true, initiatorUserId: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.initiatorUserId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden (only initiator can reset)" }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await tx.debateTurn.deleteMany({ where: { sessionId } });
      if (clearVotes) {
        await tx.audienceVoteEvent.deleteMany({ where: { sessionId } });
        await tx.audienceVoteSnapshot.deleteMany({ where: { sessionId } });
      }
      await tx.debateSession.update({
        where: { id: sessionId },
        data: {
          status: "OPENING",
          winnerSide: null,
          closedAt: null,
          abortedAt: null,
          crossExamEnabled: null,
          crossExamFirstSide: null,
          seq: 1,
          nextTurnAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SESSION_RESET] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to reset session", details: String(err) }, { status: 500 });
  }
}

