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
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const turns = await db.debateTurn.findMany({
      where: { sessionId },
      orderBy: { seq: "asc" },
      select: {
        id: true,
        seq: true,
        type: true,
        speakerSeat: true,
        speakerParticipantId: true,
        content: true,
        meta: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: turns });
  } catch (err) {
    console.error("[SESSION_TIMELINE] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch timeline", details: String(err) }, { status: 500 });
  }
}
