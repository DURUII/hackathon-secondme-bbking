import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const opts = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
  response.cookies.set("session_id", "", opts);
  response.cookies.set("secondme_access_token", "", opts);
  response.cookies.set("secondme_refresh_token", "", opts);
  return response;
}
