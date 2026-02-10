import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy SessionMessages][${requestId}]`;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  console.log(`${logPrefix} BEGIN`, { stage: "begin", hasSessionId: Boolean(sessionId) });

  if (!sessionId) {
    console.error(`${logPrefix} END`, { stage: "missing_session_id" });
    return NextResponse.json({ code: 400, message: "Missing sessionId", data: null }, { status: 400 });
  }

  const result = await secondMeFetch(`/api/secondme/chat/session/messages?sessionId=${encodeURIComponent(sessionId)}`);
  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  const json = await readJsonOrText(result.resp);
  console.log(`${logPrefix} END`, { stage: result.ok ? "success" : "upstream_failed", status: result.status });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
