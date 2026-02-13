import { NextResponse } from "next/server";
import { DebateEngine } from "@/lib/debate-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
      if (process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await DebateEngine.processDueSessions(8);

    return NextResponse.json({
      success: true,
      debating: result,
    });
  } catch (err) {
    console.error("[INTERNAL_DEBATE_HEARTBEAT] Error:", err);
    return NextResponse.json({ success: false, error: "Heartbeat failed", details: String(err) }, { status: 500 });
  }
}

