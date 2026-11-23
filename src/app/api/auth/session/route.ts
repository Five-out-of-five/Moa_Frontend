import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAuthMock } from "@/features/auth/config";
import { isSameOriginRequest } from "@/features/auth/origin";
import { getAuthReturnPath } from "@/features/auth/return-path";
import { clearAuthTokens, refreshAuthSession } from "@/features/auth/session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "허용되지 않은 요청이에요." }, { status: 403 });
  if (isAuthMock) return NextResponse.json({ error: "실서버 인증이 비활성화되어 있어요." }, { status: 400 });
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "요청을 확인해 주세요." }, { status: 400 });
  const jar = await cookies();
  const returnPath = getAuthReturnPath("returnPath" in input ? input.returnPath : null) ?? getAuthReturnPath(jar.get("moa_auth_return")?.value) ?? "/workspaces";
  try {
    await refreshAuthSession();
    jar.delete("moa_auth_return");
    if ("reason" in input && input.reason === "expired") jar.set("moa_auth_retry", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 10 });
    return NextResponse.json({ redirectTo: returnPath }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await clearAuthTokens();
    return NextResponse.json({ error: "로그인 세션을 갱신하지 못했어요. 다시 로그인해 주세요." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
