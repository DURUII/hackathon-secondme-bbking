import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth-helper";
import { DebateEngine } from "@/lib/debate-engine";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const questionId = (await ctx.params).id;
    if (!questionId) {
      return NextResponse.json({ success: false, error: "Missing question id" }, { status: 400 });
    }

    const { session, created } = await DebateEngine.createSession({
      questionId,
      initiatorUserId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        questionId: session.questionId,
        initiatorUserId: session.initiatorUserId,
        status: session.status,
        created,
        createdAt: session.createdAt,
        seats: session.seats.map((s) => ({
          seat: s.seat,
          participantId: s.participantId,
          participant: {
            name: s.participant.name,
            avatarUrl: s.participant.avatarUrl,
          },
        })),
      },
    });
  } catch (err) {
    console.error("[QUESTION_SESSION_CREATE] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }
}
