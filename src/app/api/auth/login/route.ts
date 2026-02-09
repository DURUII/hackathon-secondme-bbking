import { NextResponse } from "next/server";

function mask(value: string | undefined) {
  if (!value) return "<empty>";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[SecondMe OAuth Login][${requestId}]`;
  console.log(`${logPrefix} BEGIN`, {
    stage: "begin",
  });

  const clientId = process.env.SECONDME_CLIENT_ID;
  const redirectUri = process.env.SECONDME_REDIRECT_URI;
  const scope = "user.info user.info.shades";
  const state = crypto.randomUUID();

  console.log(`${logPrefix} MIDDLE(中间变量)`, {
    stage: "env",
    clientId: mask(clientId),
    redirectUri,
    oauthUrl: process.env.SECONDME_OAUTH_URL,
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
