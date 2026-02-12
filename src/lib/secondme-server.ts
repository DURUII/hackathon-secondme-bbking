import { cookies } from "next/headers";

export function getSecondMeApiBaseUrl() {
  return process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
}

export function getRedirectUri(): string {
  return process.env.SECONDME_REDIRECT_URI || "";
}

export async function getSecondMeAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("secondme_access_token")?.value;
}

export function buildSecondMeEndpoint(pathname: string) {
  const base = getSecondMeApiBaseUrl().replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export async function secondMeFetch(
  endpointPath: string,
  init: RequestInit & { requestId?: string } = {}
) {
  const accessToken = await getSecondMeAccessToken();
  if (!accessToken) {
    return {
      hasAuth: false as const,
      ok: false,
      status: 401,
      error: { code: 401, message: "Not authenticated", data: null },
      accessToken: null as string | null,
    };
  }

  const endpoint = endpointPath.startsWith("http")
    ? endpointPath
    : buildSecondMeEndpoint(endpointPath);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    resp = new Response(
      JSON.stringify({
        code: 502,
        message: `Upstream request failed: ${message}`,
        data: { endpoint },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  return { hasAuth: true as const, ok: resp.ok, status: resp.status, resp, accessToken };
}
