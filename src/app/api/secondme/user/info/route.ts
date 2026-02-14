import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";
import { db } from "@/lib/db";
import { getSecondMeAccessToken } from "@/lib/secondme-server";
import { getReqLogContext, logApiBegin, logApiEnd, logApiError, logEvent } from "@/lib/obs/server-log";

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

  // --- Auto-Sync User to Database ---
  const userInfo = json?.data;
  const secondmeUserId = userInfo?.id ?? userInfo?.userId;
  if (result.ok && secondmeUserId && userInfo) {
      try {
          const accessToken = await getSecondMeAccessToken();
          const normalizedSecondmeUserId = String(secondmeUserId);
          
          if (accessToken) {
              await db.user.upsert({
                  where: { secondmeUserId: normalizedSecondmeUserId },
                  update: {
                      accessToken: accessToken,
                      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Refresh expiry
                  },
                  create: {
                      secondmeUserId: normalizedSecondmeUserId,
                      accessToken: accessToken,
                      refreshToken: "", // We don't have refresh token here, but that's fine
                      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  }
              });
              
              // Also sync Participant
              await db.participant.upsert({
                  where: { secondmeId: normalizedSecondmeUserId },
                  update: {
                      lastActiveAt: new Date(),
                      name: userInfo.name || userInfo.nickname || '用户',
                      avatarUrl: userInfo.avatar || userInfo.avatarUrl,
                      isActive: true
                  },
                  create: {
                      secondmeId: normalizedSecondmeUserId,
                      name: userInfo.name || userInfo.nickname || '用户',
                      avatarUrl: userInfo.avatar || userInfo.avatarUrl,
                      isActive: true
                  }
              });
              
              logEvent("info", "api.secondme_user_info.sync", {
                requestId: ctx.requestId,
                clientTraceId: ctx.clientTraceId,
                secondmeUserId: normalizedSecondmeUserId,
              });
          }
      } catch (e) {
          logApiError(ctx, "api.secondme_user_info", { dur_ms: Date.now() - t0, status: result.status, stage: "sync_error" }, e);
      }
  }
  // ----------------------------------

  logApiEnd(ctx, "api.secondme_user_info", {
    status: result.status,
    dur_ms: Date.now() - t0,
    stage: result.ok ? "success" : "upstream_failed",
  });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
