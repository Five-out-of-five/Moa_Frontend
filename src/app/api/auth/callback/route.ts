import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAuthMock } from "@/features/auth/config";
import { getInviteReturnPath } from "@/features/auth/mock-session";
import { clearAuthTokens, refreshAuthSession } from "@/features/auth/session";

export async function GET(request: Request) {
  if (isAuthMock) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const jar = await cookies();
  const next = getInviteReturnPath(jar.get("moa_auth_return")?.value);
  const ticket = query.get("ticket");
  if (ticket && ticket.length < 2048) {
    const target = new URL(`/signup/${encodeURIComponent(ticket)}`, request.url);
    if (next) target.searchParams.set("next", next);
    jar.delete("moa_auth_return");
    return NextResponse.redirect(target);
  }
  if (query.has("error")) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  try {
    await refreshAuthSession();
    jar.delete("moa_auth_return");
    return NextResponse.redirect(new URL(next ?? "/workspaces", request.url));
  } catch {
    await clearAuthTokens();
    return NextResponse.redirect(new URL("/login?error=session", request.url));
  }
}
