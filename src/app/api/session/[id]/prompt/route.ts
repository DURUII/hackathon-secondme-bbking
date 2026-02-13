import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

function normalizeText(v: unknown, maxLen: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  // Treat blank as "clear" so DebateEngine falls back to defaults.
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = (await ctx.params).id;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      systemPrompt?: unknown;
      actControl?: unknown;
      promptVersion?: unknown;
    } | null;

    const hasSystemPrompt = !!body && Object.prototype.hasOwnProperty.call(body, "systemPrompt");
    const hasActControl = !!body && Object.prototype.hasOwnProperty.call(body, "actControl");
    const hasPromptVersion = !!body && Object.prototype.hasOwnProperty.call(body, "promptVersion");

    const systemPrompt = hasSystemPrompt ? normalizeText(body?.systemPrompt, 8000) : null;
    const actControl = hasActControl ? normalizeText(body?.actControl, 8000) : null;
    const promptVersion = hasPromptVersion ? normalizeText(body?.promptVersion, 128) : null;

    if (!hasSystemPrompt && !hasActControl && !hasPromptVersion) {
      return NextResponse.json(
        { success: false, error: "No valid fields. Provide systemPrompt and/or actControl and/or promptVersion." },
        { status: 400 }
      );
    }

    const session = await db.debateSession.findUnique({
      where: { id: sessionId },
      select: { id: true, initiatorUserId: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.initiatorUserId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden (only initiator can edit prompts)" }, { status: 403 });
    }

    const updated = await db.debateSession.update({
      where: { id: sessionId },
      data: {
        ...(hasSystemPrompt ? { systemPrompt } : {}),
        ...(hasActControl ? { actControl } : {}),
        ...(hasPromptVersion ? { promptVersion } : {}),
      },
      select: { id: true, systemPrompt: true, actControl: true, promptVersion: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[SESSION_PROMPT_PATCH] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to update prompts", details: String(err) }, { status: 500 });
  }
}
