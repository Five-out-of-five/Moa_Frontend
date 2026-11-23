import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL(url.searchParams.has("ticket") ? "/signup" : "/auth/callback", request.url);
  target.search = url.search;
  return NextResponse.redirect(target);
}
