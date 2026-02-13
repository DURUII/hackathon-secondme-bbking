import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

function normalizePosition(v: unknown): "PRO" | "CON" | null {
  if (v === "PRO" || v === "CON") return v;
  return null;
}

function getVoteRateLimitMs(): number {
  const v = Number(process.env.AUDIENCE_VOTE_RATE_LIMIT_MS ?? 1500);
  return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 1500;
}

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

    const body = (await request.json().catch(() => null)) as { position?: unknown } | null;
    const position = normalizePosition(body?.position);
    if (!position) {
      return NextResponse.json({ success: false, error: "position must be PRO or CON" }, { status: 400 });
    }

    const session = await db.debateSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.status === "CLOSED" || session.status === "ABORTED") {
      return NextResponse.json({ success: false, error: "Session is closed" }, { status: 400 });
    }

    const snapshot = await db.audienceVoteSnapshot.findUnique({
      where: { sessionId_userId: { sessionId, userId: user.id } },
      select: { id: true, currentPosition: true, updatedAt: true },
    });
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: "openingPosition not set; call /opening first" },
        { status: 400 }
      );
    }

    const rateLimitMs = getVoteRateLimitMs();
    if (rateLimitMs > 0 && Date.now() - snapshot.updatedAt.getTime() < rateLimitMs) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    if (snapshot.currentPosition === position) {
      return NextResponse.json({
        success: true,
        data: { changed: false, currentPosition: snapshot.currentPosition },
      });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.audienceVoteEvent.create({
        data: {
          sessionId,
          userId: user.id,
          position,
        },
      });
      return tx.audienceVoteSnapshot.update({
        where: { sessionId_userId: { sessionId, userId: user.id } },
        data: { currentPosition: position },
      });
    });

    return NextResponse.json({
      success: true,
      data: { changed: true, currentPosition: updated.currentPosition, updatedAt: updated.updatedAt },
    });
  } catch (err) {
    console.error("[SESSION_VOTE] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to vote", details: String(err) }, { status: 500 });
  }
}
