import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAuthMock } from "@/features/auth/config";
import { getAuthReturnPath } from "@/features/auth/return-path";
import { BACKEND_BASE_URL } from "@/lib/endpoints";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider.toUpperCase();
  if (isAuthMock || !["GOOGLE", "KAKAO", "NAVER"].includes(provider)) return new Response(null, { status: 404 });
  const destination = process.env[`AUTH_${provider}_LOGIN_URL`] || `${process.env.AUTH_OAUTH_BASE_URL || (process.env.NODE_ENV === "production" ? new URL(request.url).origin : BACKEND_BASE_URL)}/oauth2/authorization/${provider.toLowerCase()}`;
  const url = new URL(destination);
  if (!["http:", "https:"].includes(url.protocol)) return new Response(null, { status: 500 });
  const query = new URL(request.url).searchParams;
  const next = getAuthReturnPath(query.get("returnPath") ?? query.get("next"));
  const jar = await cookies();
  if (next) jar.set("moa_auth_return", next, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300,
  });
  else jar.delete("moa_auth_return");
  if (next) url.searchParams.set("returnPath", next);
  return NextResponse.redirect(url);
}
