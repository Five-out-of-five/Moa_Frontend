import "server-only";

import { ApiError } from "@/lib/api";

import { getAuthLoginHref, getSuspendedUntil } from "./errors";

export function getAuthFailure(error: unknown) {
  if (error instanceof ApiError) {
    const until = getSuspendedUntil(error.data);
    const requiresLogin = error.status === 401 || error.code === "AUTH_ACCOUNT_SUSPENDED";
    return { status: error.status, error: error.message, code: error.code, traceId: error.traceId, until, redirectTo: requiresLogin ? getAuthLoginHref(error.code, until, error.traceId) : undefined };
  }
  const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
  return { status: timeout ? 504 : 503, error: timeout ? "로그인 확인 시간이 길어졌어요. 다시 시도해 주세요." : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", code: timeout ? "AUTH_REQUEST_TIMEOUT" : "AUTH_REQUEST_FAILED", traceId: undefined, until: undefined, redirectTo: undefined };
}
