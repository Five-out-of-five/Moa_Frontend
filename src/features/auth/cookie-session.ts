import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

export const ACCESS_COOKIE_NAME = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
export const tokenSchema = z.object({ accessToken: z.string().min(1), accessTokenExpiresAt: z.string().datetime({ offset: true }) });

export async function relayRefreshCookie(headers: Headers) {
  const jar = await cookies();
  for (const cookie of headers.getSetCookie()) {
    const [pair, ...parts] = cookie.split(";");
    if (!pair.startsWith("refreshToken=")) continue;
    const attributes = new Map(parts.map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key.toLowerCase(), value.join("=")] as const;
    }));
    const sameSite = attributes.get("samesite")?.toLowerCase();
    jar.set("refreshToken", pair.slice("refreshToken=".length), {
      httpOnly: true,
      path: attributes.get("path") || "/",
      secure: attributes.has("secure"),
      sameSite: sameSite === "none" || sameSite === "lax" ? sameSite : "strict",
      ...(attributes.has("domain") ? { domain: attributes.get("domain") } : {}),
      ...(attributes.has("max-age") ? { maxAge: Number(attributes.get("max-age")) } : {}),
      ...(attributes.has("expires") ? { expires: new Date(attributes.get("expires")!) } : {}),
    });
  }
}

export async function storeAuthTokens(value: unknown, headers: Headers) {
  const token = tokenSchema.parse(value);
  if (Date.parse(token.accessTokenExpiresAt) <= Date.now()) throw new Error("인증 토큰이 만료됐어요.");
  (await cookies()).set(ACCESS_COOKIE_NAME, token.accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(token.accessTokenExpiresAt),
  });
  await relayRefreshCookie(headers);
}
