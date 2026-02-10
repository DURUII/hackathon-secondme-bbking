import { cookies } from "next/headers";

export function getSecondMeApiBaseUrl() {
  return process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
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

  const resp = await fetch(endpoint, {
    ...init,
    headers,
    cache: "no-store",
  });

  return { hasAuth: true as const, ok: resp.ok, status: resp.status, resp, accessToken };
}
