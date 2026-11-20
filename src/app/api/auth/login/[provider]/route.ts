import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAuthMock } from "@/features/auth/config";
import { getInviteReturnPath } from "@/features/auth/mock-session";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider.toUpperCase();
  if (isAuthMock || !["GOOGLE", "KAKAO", "NAVER"].includes(provider)) return new Response(null, { status: 404 });
  const destination = process.env[`AUTH_${provider}_LOGIN_URL`];
  if (!destination) return NextResponse.redirect(new URL("/login", request.url));
  const url = new URL(destination);
  if (!["http:", "https:"].includes(url.protocol)) return new Response(null, { status: 500 });
  const next = getInviteReturnPath(new URL(request.url).searchParams.get("next"));
  const jar = await cookies();
  if (next) jar.set("moa_auth_return", next, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600,
  });
  else jar.delete("moa_auth_return");
  return NextResponse.redirect(url);
}
