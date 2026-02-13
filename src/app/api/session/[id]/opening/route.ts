import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

function normalizePosition(v: unknown): "PRO" | "CON" | null {
  if (v === "PRO" || v === "CON") return v;
  return null;
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

    const existing = await db.audienceVoteSnapshot.findUnique({
      where: { sessionId_userId: { sessionId, userId: user.id } },
      select: { id: true, openingPosition: true, currentPosition: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "openingPosition already set", data: existing },
        { status: 409 }
      );
    }

    // Avoid transaction usage here to reduce "Transaction not found" issues in dev/HMR.
    // Minor inconsistency is acceptable for now; core UX is entering the session quickly.
    const created = await db.audienceVoteSnapshot.create({
      data: {
        sessionId,
        userId: user.id,
        openingPosition: position,
        currentPosition: position,
      },
    });
    await db.audienceVoteEvent.create({
      data: {
        sessionId,
        userId: user.id,
        position,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    console.error("[SESSION_OPENING] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to set opening position", details: String(err) }, { status: 500 });
  }
}
