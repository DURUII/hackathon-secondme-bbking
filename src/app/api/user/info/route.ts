import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function pickString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe UserInfo][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, {
    stage: "begin",
  });

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  console.log(`${logPrefix} MIDDLE(中间变量)`, {
    stage: "cookie_check",
    hasAccessToken: Boolean(accessToken),
    accessTokenPreview: accessToken ? `${accessToken.slice(0, 4)}...` : "<empty>",
  });

  if (!accessToken) {
    console.warn(`${logPrefix} END`, {
      stage: "unauthorized_no_token",
    });
    return NextResponse.json(
      { code: 401, message: "Not authenticated", data: null },
      { status: 401 }
    );
  }

  const baseUrl = process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/secondme/user/info`;
  console.log(`${logPrefix} MIDDLE(中间变量)`, {
    stage: "request_upstream",
    endpoint,
  });

  const resp = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`${logPrefix} END`, {
      stage: "upstream_http_failed",
      status: resp.status,
      responseSnippet: errorText.slice(0, 400),
    });
    return NextResponse.json(
      { code: resp.status, message: "Failed to fetch user info", data: null },
      { status: 502 }
    );
  }

  const json = (await resp.json()) as
    | {
        code?: number;
        message?: string;
        data?: Record<string, unknown>;
      }
    | undefined;

  if (typeof json?.code === "number" && json.code !== 0) {
    console.error(`${logPrefix} END`, {
      stage: "upstream_business_failed",
      upstreamCode: json.code,
      upstreamMessage: json.message,
      upstreamDataPreview: json.data ?? null,
    });
    return NextResponse.json(
      { code: json.code, message: json.message ?? "User info api failed", data: null },
      { status: 502 }
    );
  }

  const source = (json?.data ?? {}) as Record<string, unknown>;
  const profile = (source.profile ?? {}) as Record<string, unknown>;
  const user = (source.user ?? {}) as Record<string, unknown>;

  const name = pickString(
    source.name,
    source.nickname,
    source.userName,
    source.username,
    profile.name,
    profile.nickname,
    user.name,
    user.nickname
  );
  const bio = pickString(
    source.bio,
    source.description,
    source.intro,
    profile.bio,
    profile.description
  );
  const avatar = pickString(
    source.avatar,
    source.avatarUrl,
    source.avatar_url,
    profile.avatar,
    profile.avatarUrl
  );

  const normalized = {
    ...source,
    name: name ?? null,
    bio: bio ?? null,
    avatar: avatar ?? null,
  };

  console.log(`${logPrefix} END`, {
    stage: "success",
    normalizedPreview: {
      name: normalized.name,
      bio: normalized.bio,
      hasAvatar: Boolean(normalized.avatar),
    },
  });

  return NextResponse.json({
    code: 0,
    data: normalized,
  });
}
