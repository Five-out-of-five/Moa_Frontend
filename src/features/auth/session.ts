import "server-only";

import { cookies } from "next/headers";

import { api } from "@/lib/api";

import { ACCESS_COOKIE_NAME, storeAuthTokens, tokenSchema } from "./cookie-session";
export { relayRefreshCookie, storeAuthTokens } from "./cookie-session";

export async function clearAuthTokens(clearRefresh = true) {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE_NAME);
  if (clearRefresh) jar.delete("refreshToken");
  jar.delete("moa_auth_retry");
}

export async function authCookieHeaders(): Promise<Record<string, string>> {
  const refresh = (await cookies()).get("refreshToken")?.value;
  return refresh ? { Cookie: `refreshToken=${refresh}` } : {};
}

export async function refreshAuthSession() {
  const headers = await authCookieHeaders();
  if (!headers.Cookie) throw new Error("갱신할 로그인 세션이 없어요.");
  let responseHeaders = new Headers();
  const value = await api("/api/v1/auth/refresh", {
    method: "POST", cache: "no-store", headers,
    onResponse: async (_, response) => { responseHeaders = response; },
  });
  const token = tokenSchema.parse(value);
  await storeAuthTokens(token, responseHeaders);
  return token.accessToken;
}
