import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await ctx.params;
    if (!questionId) {
      return NextResponse.json({ success: false, error: "Missing question id" }, { status: 400 });
    }

    const question = await db.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true },
    });
    if (!question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    const sessions = await db.debateSession.findMany({
      where: { questionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        initiatorUserId: true,
        status: true,
        winnerSide: true,
        createdAt: true,
        closedAt: true,
      },
      take: 50,
    });

    const sessionIds = sessions.map((s) => s.id);
    const [initiators, snapshotCounts] = await Promise.all([
      db.user.findMany({
        where: { id: { in: sessions.map((s) => s.initiatorUserId) } },
        select: { id: true, secondmeUserId: true },
      }),
      sessionIds.length
        ? db.audienceVoteSnapshot.groupBy({
            by: ["sessionId", "currentPosition"],
            where: { sessionId: { in: sessionIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const initiatorSecondmeIds = initiators.map((u) => u.secondmeUserId);
    const initiatorParticipants = await db.participant.findMany({
      where: { secondmeId: { in: initiatorSecondmeIds } },
      select: { secondmeId: true, name: true, avatarUrl: true },
    });
    const participantBySecondmeId = new Map(initiatorParticipants.map((p) => [p.secondmeId, p]));
    const initiatorByUserId = new Map(
      initiators.map((u) => {
        const p = participantBySecondmeId.get(u.secondmeUserId);
        return [
          u.id,
          {
            userId: u.id,
            secondmeUserId: u.secondmeUserId,
            name: p?.name ?? u.secondmeUserId,
            avatarUrl: p?.avatarUrl ?? null,
          },
        ] as const;
      })
    );

    const voteCountMap = new Map<string, { pro: number; con: number }>();
    for (const row of snapshotCounts as Array<{ sessionId: string; currentPosition: string; _count: { _all: number } }>) {
      const current = voteCountMap.get(row.sessionId) ?? { pro: 0, con: 0 };
      if (row.currentPosition === "PRO") current.pro += row._count._all;
      if (row.currentPosition === "CON") current.con += row._count._all;
      voteCountMap.set(row.sessionId, current);
    }

    return NextResponse.json({
      success: true,
      data: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        winnerSide: s.winnerSide,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
        initiator: initiatorByUserId.get(s.initiatorUserId) ?? null,
        votes: voteCountMap.get(s.id) ?? { pro: 0, con: 0 },
      })),
    });
  } catch (err) {
    console.error("[QUESTION_SESSIONS] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to list sessions", details: String(err) }, { status: 500 });
  }
}
