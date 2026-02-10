import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy TTS][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, { stage: "begin" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error(`${logPrefix} END`, { stage: "invalid_json" });
    return NextResponse.json({ code: 400, message: "Invalid JSON body", data: null }, { status: 400 });
  }

  const result = await secondMeFetch("/api/secondme/tts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  const json = await readJsonOrText(result.resp);
  console.log(`${logPrefix} END`, { stage: result.ok ? "success" : "upstream_failed", status: result.status });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
