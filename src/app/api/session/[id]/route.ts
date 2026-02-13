import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const sessionId = (await ctx.params).id;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
    }

    const session = await db.debateSession.findUnique({
      where: { id: sessionId },
      include: {
        question: { select: { id: true, content: true, arenaType: true } },
        seats: { include: { participant: true } },
      },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const counts = await db.audienceVoteSnapshot.groupBy({
      by: ["currentPosition"],
      where: { sessionId },
      _count: { _all: true },
    });
    let pro = 0;
    let con = 0;
    for (const row of counts as Array<{ currentPosition: string; _count: { _all: number } }>) {
      if (row.currentPosition === "PRO") pro += row._count._all;
      if (row.currentPosition === "CON") con += row._count._all;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        question: session.question,
        initiatorUserId: session.initiatorUserId,
        status: session.status,
        winnerSide: session.winnerSide,
        systemPrompt: session.systemPrompt,
        actControl: session.actControl,
        promptVersion: session.promptVersion,
        createdAt: session.createdAt,
        nextTurnAt: session.nextTurnAt,
        closedAt: session.closedAt,
        seats: session.seats.map((s) => ({
          seat: s.seat,
          participantId: s.participantId,
          participant: {
            name: s.participant.name,
            avatarUrl: s.participant.avatarUrl,
            interests: s.participant.interests,
          },
        })),
        votes: { pro, con },
      },
    });
  } catch (err) {
    console.error("[SESSION_GET] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch session", details: String(err) }, { status: 500 });
  }
}
