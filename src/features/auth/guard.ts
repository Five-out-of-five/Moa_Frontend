import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { api, ApiError } from "@/lib/api";

import { isAuthMock } from "./config";
import { getAuthLoginHref, getSuspendedUntil } from "./errors";
import { getAuthReturnPath } from "./return-path";

export const requireAuthSession = cache(async () => {
  if (isAuthMock) return;
  const jar = await cookies();
  if (!jar.has(process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken")) {
    const next = getAuthReturnPath((await headers()).get("x-moa-request-path")) ?? "/workspaces";
    if (jar.has("refreshToken")) redirect(`/auth/callback?returnPath=${encodeURIComponent(next)}`);
    redirect(`/login?returnPath=${encodeURIComponent(next)}`);
  }
  try { await api("/api/v1/accounts/me", { cache: "no-store" }); }
  catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.code === "AUTH_ACCOUNT_SUSPENDED")) {
      const returnPath = error.status === 401
        ? getAuthReturnPath((await headers()).get("x-moa-request-path")) ?? undefined
        : undefined;
      redirect(getAuthLoginHref(error.code === "AUTH_ACCOUNT_SUSPENDED" ? error.code : "session", getSuspendedUntil(error.data), error.traceId, returnPath));
    }
    throw error;
  }
});
