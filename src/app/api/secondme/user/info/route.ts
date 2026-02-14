import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";
import { getReqLogContext, logApiBegin, logApiEnd } from "@/lib/obs/server-log";

export async function GET(req: Request) {
  const ctx = getReqLogContext(req);
  const t0 = Date.now();
  logApiBegin(ctx, "api.secondme_user_info", {});

  const result = await secondMeFetch("/api/secondme/user/info");
  if (!result.hasAuth) {
    logApiEnd(ctx, "api.secondme_user_info", { status: result.status, dur_ms: Date.now() - t0, stage: "unauthorized" });
    return NextResponse.json(result.error, { status: result.status });
  }

  type UserInfo = {
    id?: string;
    userId?: string;
    name?: string;
    nickname?: string;
    avatar?: string;
    avatarUrl?: string;
  };

  type UserInfoResponse = { data?: UserInfo } | undefined;

  const parsed = await readJsonOrText(result.resp);
  const json: UserInfoResponse =
    parsed && typeof parsed === "object" && "data" in parsed
      ? (parsed as UserInfoResponse)
      : undefined;

  // Note: avoid DB writes here; keep this endpoint as a fast read proxy.

  logApiEnd(ctx, "api.secondme_user_info", {
    status: result.status,
    dur_ms: Date.now() - t0,
    stage: result.ok ? "success" : "upstream_failed",
  });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
