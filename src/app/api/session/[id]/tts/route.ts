import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { SecondMePollEngine } from "@/lib/secondme-poll-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pickString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function extractTtsAudioUrl(data: Record<string, unknown>): string | null {
  return (
    pickString(
      data.audioUrl,
      data.audioURL,
      data.audio_url,
      data.url,
      data.voiceUrl,
      data.voice_url,
      data.fileUrl,
      data.file_url
    ) ?? null
  );
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getUserFromToken();
    if (!viewer) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = (await ctx.params).id;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { seat?: unknown; text?: unknown } | null;
    const seat = typeof body?.seat === "string" ? body.seat.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!seat || !text) {
      return NextResponse.json({ success: false, error: "Missing seat or text" }, { status: 400 });
    }

    // Hard cap to avoid abuse / huge bills.
    const clipped = text.slice(0, 140);

    const seatRow = await db.debateSeat.findUnique({
      where: { sessionId_seat: { sessionId, seat } },
      select: { participantId: true },
    });
    if (!seatRow) {
      return NextResponse.json({ success: false, error: "Seat not found in this session" }, { status: 404 });
    }

    const token = await SecondMePollEngine.getFreshToken(seatRow.participantId);
    if (!token) {
      return NextResponse.json({ success: false, error: "Participant token missing" }, { status: 404 });
    }

    const baseUrl = process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/secondme/tts/generate`;

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: clipped }),
      cache: "no-store",
    });

    const raw = await upstream.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = { code: upstream.status, message: raw.slice(0, 300), data: null };
    }

    if (!upstream.ok || (typeof json?.code === "number" && json.code !== 0)) {
      return NextResponse.json(
        { success: false, error: json?.message || `Upstream failed (HTTP ${upstream.status})` },
        { status: 502 }
      );
    }

    const audioUrl = extractTtsAudioUrl(asObject(json?.data));
    if (!audioUrl) {
      return NextResponse.json({ success: false, error: "Missing audioUrl in upstream response" }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: { audioUrl } });
  } catch (err) {
    console.error("[SESSION_TTS] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate TTS", details: String(err) }, { status: 500 });
  }
}

