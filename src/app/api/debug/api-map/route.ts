import { NextResponse } from "next/server";

export async function GET() {
  const apiBase = process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
  const oauthAuthorizeBase = process.env.SECONDME_OAUTH_URL || "https://go.second.me/oauth/";
  const tokenEndpoint =
    process.env.SECONDME_TOKEN_ENDPOINT || "https://app.mindos.com/gate/lab/api/oauth/token/code";

  const secondMeRoutes = [
    {
      endpoint: "/api/secondme/user/info",
      method: "GET",
      scopesRequired: ["user.info"],
      description: "获取用户信息（userId, name, email, avatar, bio 等）",
      request: { query: {}, headers: {}, body: null },
      upstream: { method: "GET", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/user/info` },
      response: { type: "json", notes: ["通用格式: { code, message?, data }"] },
    },
    {
      endpoint: "/api/secondme/user/shades",
      method: "GET",
      scopesRequired: ["user.info.shades"],
      description: "获取用户兴趣标签",
      request: { query: {}, headers: {}, body: null },
      upstream: { method: "GET", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/user/shades` },
      response: { type: "json" },
    },
    {
      endpoint: "/api/secondme/user/softmemory",
      method: "GET",
      scopesRequired: ["user.info.softmemory"],
      description: "获取用户软记忆",
      request: {
        query: {
          keyword: { type: "string", optional: true },
          pageNo: { type: "number", optional: true, example: 1 },
          pageSize: { type: "number", optional: true, example: 10 },
        },
        headers: {},
        body: null,
      },
      upstream: { method: "GET", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/user/softmemory` },
      response: { type: "json", notes: ["data.list 为软记忆数组（如存在）"] },
    },
    {
      endpoint: "/api/secondme/note/add",
      method: "POST",
      scopesRequired: ["note.add"],
      description: "添加笔记（TEXT 或 LINK）",
      request: {
        headers: { "Content-Type": "application/json" },
        body: {
          type: "TEXT | LINK",
          content: "string (when TEXT)",
          urls: "string[] (when LINK)",
        },
      },
      upstream: { method: "POST", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/note/add` },
      response: { type: "json" },
    },
    {
      endpoint: "/api/secondme/tts/generate",
      method: "POST",
      scopesRequired: ["voice"],
      description: "语音合成 (TTS)",
      request: {
        headers: { "Content-Type": "application/json" },
        body: { text: "string (<=10000 chars)", emotion: "string | undefined" },
      },
      upstream: { method: "POST", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/tts/generate` },
      response: { type: "json" },
    },
    {
      endpoint: "/api/secondme/chat/stream",
      method: "POST",
      scopesRequired: ["chat"],
      description: "流式聊天 (SSE)",
      request: { headers: { "Content-Type": "application/json" }, body: { message: "string", sessionId: "string?" } },
      upstream: { method: "POST", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/chat/stream` },
      response: { type: "sse", notes: ["events: session/tool_call/tool_result/data/[DONE]"] },
    },
    {
      endpoint: "/api/secondme/act/stream",
      method: "POST",
      scopesRequired: ["chat"],
      description: "流式动作判断 (Act, SSE)",
      request: {
        headers: { "Content-Type": "application/json" },
        body: { message: "string", actionControl: "string (20-8000 chars)", sessionId: "string?" },
      },
      upstream: { method: "POST", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/act/stream` },
      response: { type: "sse" },
    },
    {
      endpoint: "/api/secondme/chat/session/list",
      method: "GET",
      scopesRequired: ["chat"],
      description: "获取会话列表",
      request: { query: {}, headers: {}, body: null },
      upstream: { method: "GET", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/chat/session/list` },
      response: { type: "json" },
    },
    {
      endpoint: "/api/secondme/chat/session/messages",
      method: "GET",
      scopesRequired: ["chat"],
      description: "获取会话消息历史",
      request: { query: { sessionId: { type: "string", required: true } }, headers: {}, body: null },
      upstream: { method: "GET", endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/chat/session/messages` },
      response: { type: "json" },
    },
  ];

  const map = {
    generatedAt: new Date().toISOString(),
    project: {
      framework: "Next.js App Router",
      notes: [
        "This map describes APIs currently implemented in this repo and the upstream SecondMe endpoints they call.",
        "Local routes are relative to this app host. Upstream routes are absolute URLs.",
      ],
    },
    cookiesUsed: [
      {
        name: "secondme_access_token",
        httpOnly: true,
        usedBy: ["GET /api/user/info"],
        description: "OAuth access token used to call SecondMe API",
      },
      {
        name: "secondme_refresh_token",
        httpOnly: true,
        usedBy: [],
        description: "OAuth refresh token (stored but not yet used for refresh in this repo)",
      },
      {
        name: "session_id",
        httpOnly: true,
        usedBy: [],
        description: "Demo session flag",
      },
    ],
    localRoutes: [
      {
        endpoint: "/api/auth/login",
        method: "GET",
        scopesRequired: [],
        description: "Build OAuth2 authorize URL and redirect to SecondMe",
        request: {
          query: {
            scope: {
              type: "string",
              example: "user.info user.info.shades user.info.softmemory note.add chat voice",
              notes: [
                "Optional. If empty or invalid, server falls back to default allowed scopes.",
                "Invalid scopes are ignored by a whitelist filter in this repo.",
              ],
            },
          },
          headers: {},
          body: null,
        },
        response: {
          type: "redirect",
          notes: ["302 Redirect to OAuth authorize page with response_type=code"],
        },
      },
      {
        endpoint: "/api/auth/callback",
        method: "GET",
        scopesRequired: [],
        description: "Handle OAuth2 callback, exchange code for tokens, set cookies",
        request: {
          query: {
            code: { type: "string", notes: ["Required. OAuth authorization code"] },
            state: { type: "string", notes: ["Not validated in this repo (debug-only)"] },
          },
          headers: {},
          body: null,
        },
        response: {
          type: "redirect",
          setsCookies: ["session_id", "secondme_access_token", "secondme_refresh_token"],
          notes: ["Redirect to / on success; redirects with ?error=... on failure"],
        },
      },
      {
        endpoint: "/api/auth/logout",
        method: "GET",
        scopesRequired: [],
        description: "Clear auth cookies and redirect to home",
        request: { query: {}, headers: {}, body: null },
        response: {
          type: "redirect",
          clearsCookies: ["session_id", "secondme_access_token", "secondme_refresh_token"],
        },
      },
      {
        endpoint: "/api/user/info",
        method: "GET",
        scopesRequired: ["user.info"],
        description: "Read access token from cookie and fetch user info from SecondMe API",
        request: {
          query: {},
          headers: {},
          body: null,
        },
        response: {
          type: "json",
          schema: {
            code: "number",
            message: "string | undefined",
            data: "object | null",
          },
          notes: ["On success returns { code: 0, data: normalizedUserInfo }"],
        },
      },
      ...secondMeRoutes,
      {
        endpoint: "/api/debug/api-map",
        method: "GET",
        scopesRequired: [],
        description: "Return this API map for inspection",
        request: { query: {}, headers: {}, body: null },
        response: { type: "json" },
      },
    ],
    upstreamCalls: [
      {
        endpoint: oauthAuthorizeBase,
        method: "GET",
        scopesRequired: ["(uses scope query param)"],
        description: "OAuth2 authorize endpoint (user-facing)",
        request: {
          query: {
            response_type: { type: "string", example: "code" },
            client_id: { type: "string" },
            redirect_uri: { type: "string" },
            scope: { type: "string", example: "user.info user.info.shades ..." },
            state: { type: "string" },
          },
          headers: {},
          body: null,
        },
        response: { type: "redirect", notes: ["Redirects back with ?code=...&state=..."] },
      },
      {
        endpoint: tokenEndpoint,
        method: "POST",
        scopesRequired: [],
        description: "Exchange authorization code for access/refresh tokens",
        request: {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: {
            grant_type: "authorization_code",
            code: "string",
            client_id: "string",
            client_secret: "string",
            redirect_uri: "string",
          },
        },
        response: {
          type: "json",
          notes: ["Repo supports both snake_case and camelCase token fields in response"],
        },
      },
      {
        endpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/user/info`,
        method: "GET",
        scopesRequired: ["user.info"],
        description: "Fetch user basic info from SecondMe API",
        request: {
          headers: { Authorization: "Bearer <secondme_access_token>" },
          body: null,
        },
        response: { type: "json", notes: ["SecondMe standard response: { code, message?, data }"] },
      },
    ],
    knownMissingInRepo: [
      {
        scope: "voice",
        suggestedEndpoint: `${apiBase.replace(/\/$/, "")}/api/secondme/tts/generate`,
        reason: "Voice scope is implemented for TTS proxy in this repo; other voice endpoints may still be missing",
      },
    ],
  };

  return NextResponse.json(map);
}
