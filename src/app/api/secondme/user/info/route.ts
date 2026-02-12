import { NextResponse } from "next/server";
import { secondMeFetch } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";
import { db } from "@/lib/db";
import { getSecondMeAccessToken } from "@/lib/secondme-server";

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe Proxy UserInfo][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, { stage: "begin" });

  const result = await secondMeFetch("/api/secondme/user/info");
  if (!result.hasAuth) {
    console.warn(`${logPrefix} END`, { stage: "unauthorized", status: result.status });
    return NextResponse.json(result.error, { status: result.status });
  }

  type UserInfo = {
    id: string;
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
  if (result.ok && json?.data?.id) {
      try {
          const accessToken = await getSecondMeAccessToken();
          const userInfo = json.data;
          const secondmeUserId = String(userInfo.id);
          
          if (accessToken) {
              await db.user.upsert({
                  where: { secondmeUserId },
                  update: {
                      accessToken: accessToken,
                      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Refresh expiry
                  },
                  create: {
                      secondmeUserId,
                      accessToken: accessToken,
                      refreshToken: "", // We don't have refresh token here, but that's fine
                      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  }
              });
              
              // Also sync Participant
              await db.participant.upsert({
                  where: { secondmeId: secondmeUserId },
                  update: {
                      lastActiveAt: new Date(),
                      name: userInfo.name || userInfo.nickname || '用户',
                      avatarUrl: userInfo.avatar || userInfo.avatarUrl,
                      isActive: true
                  },
                  create: {
                      secondmeId: secondmeUserId,
                      name: userInfo.name || userInfo.nickname || '用户',
                      avatarUrl: userInfo.avatar || userInfo.avatarUrl,
                      isActive: true
                  }
              });
              
              console.log(`${logPrefix} SYNC`, { success: true, secondmeUserId });
          }
      } catch (e) {
          console.error(`${logPrefix} SYNC_ERROR`, e);
      }
  }
  // ----------------------------------

  console.log(`${logPrefix} END`, { stage: result.ok ? "success" : "upstream_failed", status: result.status });
  return NextResponse.json(json ?? { code: result.status, message: "Empty response", data: null }, { status: result.status });
}
