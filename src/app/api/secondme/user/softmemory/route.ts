import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy SoftMemory][${requestId}]`;
  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword") ?? "";
  const pageNo = url.searchParams.get("pageNo") ?? "";
  const pageSize = url.searchParams.get("pageSize") ?? "";

  console.log(`${logPrefix} BEGIN`, {
    stage: "begin",
    keyword: keyword ? "<set>" : "<empty>",
    pageNo: pageNo || "<empty>",
    pageSize: pageSize || "<empty>",
  });

  const searchParams = new URLSearchParams();
  if (keyword) searchParams.set("keyword", keyword);
  if (pageNo) searchParams.set("pageNo", pageNo);
  if (pageSize) searchParams.set("pageSize", pageSize);
  const qs = searchParams.toString();
  const pathWithQuery = qs ? `/api/secondme/user/softmemory?${qs}` : "/api/secondme/user/softmemory";
  const result = await secondMeFetch(pathWithQuery);
  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  const json = await readJsonOrText(result.resp);
  console.log(`${logPrefix} END`, { stage: result.ok ? "success" : "upstream_failed", status: result.status });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
