import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondMeFetch, getRedirectUri } from "@/lib/secondme-server";
import { readJsonOrText } from "@/lib/secondme-http";

type TokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  code?: number;
  message?: string;
  subCode?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
};

function mask(value: string | undefined) {
  if (!value) return "<empty>";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe OAuth Callback][${requestId}]`;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  console.log(`${logPrefix} BEGIN`, {
    stage: "begin",
    path: url.pathname,
    hasCode: Boolean(code),
    state,
  });

  if (!code) {
    console.error(`${logPrefix} END`, {
      stage: "missing_code",
      query: url.search,
    });
    return NextResponse.redirect(new URL("/?error=missing_code", url));
  }

  const clientId = process.env.SECONDME_CLIENT_ID;
  const clientSecret = process.env.SECONDME_CLIENT_SECRET;
  const redirectUri = getRedirectUri();
  const configuredTokenEndpoint = process.env.SECONDME_TOKEN_ENDPOINT;
  const officialTokenEndpoint = "https://app.mindos.com/gate/lab/api/oauth/token/code";

  console.log(`${logPrefix} MIDDLE(中间变量)`, {
    stage: "env",
    clientId: mask(clientId),
    clientSecret: mask(clientSecret),
    redirectUri,
    configuredTokenEndpoint,
  });

  if (!clientId || !clientSecret || !redirectUri) {
    console.error(`${logPrefix} END`, {
      stage: "missing_oauth_env",
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasRedirectUri: Boolean(redirectUri),
    });
    return NextResponse.redirect(new URL("/?error=missing_oauth_env", url));
  }

  const tokenEndpoints = Array.from(
    new Set(
      [
        officialTokenEndpoint,
        configuredTokenEndpoint?.endsWith("/api/oauth/token") ||
        configuredTokenEndpoint?.endsWith("/oauth/token")
          ? `${configuredTokenEndpoint}/code`
          : configuredTokenEndpoint,
        configuredTokenEndpoint,
      ].filter(Boolean)
    )
  ) as string[];

  let tokenJson: TokenResponse | undefined = undefined;
  let tokenHttpOk = false;
  const attemptLogs: Array<Record<string, unknown>> = [];

  const payload = {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  };

  for (const endpoint of tokenEndpoints) {
    try {
      const tokenResp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload),
        cache: "no-store",
      });

      const rawText = await tokenResp.text();
      const snippet = rawText.slice(0, 400);
      const attempt = {
        endpoint,
        bodyType: "form",
        status: tokenResp.status,
        ok: tokenResp.ok,
        responseSnippet: snippet,
      };
      attemptLogs.push(attempt);
      console.log(`${logPrefix} MIDDLE(中间变量)`, {
        stage: "token_attempt",
        ...attempt,
      });

      if (!tokenResp.ok) {
        continue;
      }

      let parsed: TokenResponse | undefined;
      try {
        parsed = JSON.parse(rawText) as TokenResponse;
      } catch {
        attemptLogs.push({
          endpoint,
          bodyType: "form",
          parseError: "invalid_json",
        });
        console.warn(`${logPrefix} MIDDLE(中间变量)`, {
          stage: "token_parse_warning",
          endpoint,
          bodyType: "form",
          parseError: "invalid_json",
        });
        continue;
      }

      tokenHttpOk = true;
      tokenJson = parsed;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attemptLogs.push({
        endpoint,
        bodyType: "form",
        fetchError: message,
      });
      console.error(`${logPrefix} MIDDLE(中间变量)`, {
        stage: "token_fetch_exception",
        endpoint,
        bodyType: "form",
        error: message,
      });
    }
  }

  if (!tokenHttpOk || !tokenJson) {
    console.error(`${logPrefix} END`, {
      stage: "token_http_failed",
      attempts: attemptLogs,
    });
    return NextResponse.redirect(new URL("/?error=token_http_failed", url));
  }

  if (typeof tokenJson.code === "number" && tokenJson.code !== 0) {
    console.error(`${logPrefix} END`, {
      stage: "token_api_failed",
      tokenCode: tokenJson.code,
      tokenMessage: tokenJson.message,
      tokenSubCode: tokenJson.subCode,
      tokenJson,
    });
    return NextResponse.redirect(new URL("/?error=token_api_failed", url));
  }

  const accessToken =
    tokenJson.accessToken ??
    tokenJson.access_token ??
    tokenJson.data?.accessToken ??
    tokenJson.data?.access_token;
  const refreshToken =
    tokenJson.refreshToken ??
    tokenJson.refresh_token ??
    tokenJson.data?.refreshToken ??
    tokenJson.data?.refresh_token;
  const expiresIn =
    tokenJson.expiresIn ??
    tokenJson.expires_in ??
    tokenJson.data?.expiresIn ??
    tokenJson.data?.expires_in ??
    7200;

  if (!accessToken) {
    console.error(`${logPrefix} END`, {
      stage: "token_parse_failed",
      tokenJson,
    });
    return NextResponse.redirect(new URL("/?error=token_parse_failed", url));
  }

  const response = NextResponse.redirect(new URL("/", url));
  response.cookies.set("session_id", "ok", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set("secondme_access_token", accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresIn,
  });
  if (refreshToken) {
    response.cookies.set("secondme_refresh_token", refreshToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  console.log(`${logPrefix} END`, {
    stage: "success",
    accessToken: mask(accessToken),
    refreshToken: mask(refreshToken),
    expiresIn,
    cookieSet: true,
  });

  // --- Start: Upsert User to Database ---
  try {
    const userInfoEndpoint = "https://app.mindos.com/gate/lab/api/secondme/user/info";
    const userResp = await fetch(userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (userResp.ok) {
        const userJson = await userResp.json();
        const userInfo = userJson.data;
        const secondmeUserId = userInfo?.id ?? userInfo?.userId;
        if (userInfo && secondmeUserId) {
            const normalizedSecondmeUserId = String(secondmeUserId);
            console.log(`${logPrefix} DB_UPSERT START`, { secondmeUserId });
            
            await db.user.upsert({
                where: { secondmeUserId: normalizedSecondmeUserId },
                update: {
                    accessToken: accessToken,
                    refreshToken: refreshToken || "",
                    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
                },
                create: {
                    secondmeUserId: normalizedSecondmeUserId,
                    accessToken: accessToken,
                    refreshToken: refreshToken || "",
                    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
                }
            });
            console.log(`${logPrefix} DB_UPSERT`, { success: true, secondmeUserId });
            
            // Also upsert Participant
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
            console.log(`${logPrefix} PARTICIPANT_UPSERT`, { success: true });
        } else {
            console.error(`${logPrefix} DB_ERROR`, "Invalid user info structure", userJson);
        }
    } else {
        console.error(`${logPrefix} DB_ERROR`, "Fetch user info failed", userResp.status);
    }
  } catch (dbError) {
      console.error(`${logPrefix} DB_ERROR`, dbError);
      // We don't block login if DB fails, but we log it.
  }
  // --- End: Upsert User to Database ---

  return response;
}
