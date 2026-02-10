import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy ActStream][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, { stage: "begin" });

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    console.error(`${logPrefix} END`, { stage: "read_body_failed" });
    return NextResponse.json({ code: 400, message: "Failed to read request body", data: null }, { status: 400 });
  }

  const result = await secondMeFetch("/api/secondme/act/stream", {
    method: "POST",
    headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    body: bodyText,
  });

  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  if (!result.ok) {
    const json = await readJsonOrText(result.resp);
    console.warn(`${logPrefix} END`, { stage: "upstream_failed", status: result.status });
    return NextResponse.json(json ?? { code: result.status, message: "Upstream failed", data: null }, { status: result.status });
  }

  console.log(`${logPrefix} END`, { stage: "streaming", status: result.status });
  return new Response(result.resp.body, {
    status: result.status,
    headers: {
      "Content-Type": result.resp.headers.get("content-type") || "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
