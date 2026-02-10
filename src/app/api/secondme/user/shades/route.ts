import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy Shades][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, { stage: "begin" });

  const result = await secondMeFetch("/api/secondme/user/shades");
  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  const json = await readJsonOrText(result.resp);
  console.log(`${logPrefix} END`, { stage: result.ok ? "success" : "upstream_failed", status: result.status });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
