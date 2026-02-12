import { NextResponse } from "next/server";
import { ALLOWED_SECONDME_SCOPES, DEFAULT_SECONDME_SCOPES } from "@/lib/secondme-scopes";
import { getRedirectUri } from "@/lib/secondme-server";

function mask(value: string | undefined) {
  if (!value) return "<empty>";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveScopes(rawScope: string | null) {
  const requested = (rawScope ?? "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const uniqueRequested = Array.from(new Set(requested));
  const allowedSet = new Set<string>(ALLOWED_SECONDME_SCOPES);
  const validScopes = uniqueRequested.filter((scope) => allowedSet.has(scope));
  const invalidScopes = uniqueRequested.filter((scope) => !allowedSet.has(scope));
  const usedDefault = validScopes.length === 0;
  const scope = (usedDefault ? DEFAULT_SECONDME_SCOPES : validScopes).join(" ");

  return {
    scope,
    usedDefault,
    requestedScopes: uniqueRequested,
    invalidScopes,
  };
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe OAuth Login][${requestId}]`;
  const currentUrl = new URL(request.url);

  console.log(`${logPrefix} BEGIN`, {
    stage: "begin",
  });

  const clientId = process.env.SECONDME_CLIENT_ID;
  const redirectUri = getRedirectUri();
  const rawScope = currentUrl.searchParams.get("scope");
  const { scope, usedDefault, requestedScopes, invalidScopes } = resolveScopes(rawScope);
  const state = crypto.randomUUID();

  console.log(`${logPrefix} MIDDLE(中间变量)`, {
    stage: "env",
    clientId: mask(clientId),
    redirectUri,
    oauthUrl: process.env.SECONDME_OAUTH_URL,
    requestedScopes,
    invalidScopes,
    usedDefault,
    scope,
    state,
  });

  if (!clientId || !redirectUri) {
    console.error(`${logPrefix} END`, {
      stage: "missing_env",
      hasClientId: Boolean(clientId),
      hasRedirectUri: Boolean(redirectUri),
    });
    return NextResponse.json(
      {
        error:
          "Missing environment variables: SECONDME_CLIENT_ID and SECONDME_REDIRECT_URI are required",
      },
      { status: 500 }
    );
  }

  const oauthBase = process.env.SECONDME_OAUTH_URL || "https://go.second.me/oauth/";
  const url = new URL(oauthBase);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  console.log(`${logPrefix} END`, {
    stage: "redirect",
    redirectTo: url.toString(),
  });

  return NextResponse.redirect(url);
}
