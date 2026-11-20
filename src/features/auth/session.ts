import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { api } from "@/lib/api";

const tokenSchema = z.object({ accessToken: z.string().min(1), accessTokenExpiresAt: z.string().datetime({ offset: true }) });
const accessName = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
const refreshName = "refreshToken";

export async function storeAuthTokens(value: unknown, headers: Headers) {
  const token = tokenSchema.parse(value);
  if (Date.parse(token.accessTokenExpiresAt) <= Date.now()) throw new Error("인증 토큰이 만료됐습니다.");
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  jar.set(accessName, token.accessToken, { ...options, expires: new Date(token.accessTokenExpiresAt) });
  for (const cookie of headers.getSetCookie()) {
    const match = cookie.match(/^refreshToken=([^;]*)/i);
    if (!match) continue;
    const maxAge = cookie.match(/;\s*Max-Age=(\d+)/i);
    const expires = cookie.match(/;\s*Expires=([^;]+)/i);
    jar.set(refreshName, match[1], {
      ...options,
      ...(maxAge ? { maxAge: Number(maxAge[1]) } : expires ? { expires: new Date(expires[1]) } : {}),
    });
  }
}

export async function clearAuthTokens() {
  const jar = await cookies();
  jar.delete(accessName);
  jar.delete(refreshName);
}

export async function authCookieHeaders() {
  const jar = await cookies();
  const refresh = jar.get(refreshName)?.value;
  return {
    ...(refresh ? { Cookie: `refreshToken=${refresh}` } : {}),
    ...(process.env.AUTH_FRONTEND_ORIGIN ? { Origin: process.env.AUTH_FRONTEND_ORIGIN } : {}),
  };
}

export async function refreshAuthSession() {
  await api("/api/v1/auth/refresh", {
    method: "POST", cache: "no-store", headers: await authCookieHeaders(),
    onResponse: storeAuthTokens,
  });
}
