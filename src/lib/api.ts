import "server-only";

import { cookies, headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { isAuthMock } from "@/features/auth/config";
import { getAuthLoginHref, getSuspendedUntil } from "@/features/auth/errors";
import { getAuthReturnPath } from "@/features/auth/return-path";

import { BACKEND_BASE_URL, DEFAULT_TIMEOUT_MS } from "./endpoints";

/**
 * BE 호출 창구 — **Next 서버에서만** 돈다.
 *
 * 브라우저는 Next 서버(Server Action·Route Handler) 에만 말을 걸고, BE 와의 대화는 여기가
 * 대신한다. 토큰은 httpOnly 쿠키에서 읽어 헤더로 붙이므로 **브라우저 JS 는 토큰을 못 본다.**
 *
 * ⚠️ **봉투를 벗기는 일은 여기 한 곳에서만 한다.**
 *   성공 봉투: `{ success: true, data: ... }`
 *   실패 봉투: `{ success: false, error: { code, message, errors?: [{ field, reason }] } }`
 *   컴포넌트가 봉투를 알면 모양이 바뀔 때 전 화면을 고쳐야 한다.
 *
 * ⚠️ `message` 는 **화면에 그대로 띄울 한국어 문장**이다. 코드로 문구를 조립하지 않는다.
 *    실패의 `code` (`AUTH_ACCESS_TOKEN_EXPIRED` 등) 는 **분기용**이다.
 */

export interface ApiEnvelopeSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorField {
  field: string;
  reason: string;
}

export interface ApiEnvelopeFailure {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: ApiErrorField[];
    traceId?: string;
    data?: unknown;
  };
}

export type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeFailure;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly fields?: ApiErrorField[],
    readonly traceId?: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiInit extends Omit<RequestInit, "body"> {
  body?: FormData;
  /** JSON 으로 직렬화해 보낼 본문 */
  json?: unknown;
  /** 호출별 타임아웃 (ms) — 기본 {@link DEFAULT_TIMEOUT_MS} */
  timeoutMs?: number;
  /** Access Token — 로그인 전 화면이면 넘기지 않는다 */
  accessToken?: string;
  onResponse?: (data: unknown, headers: Headers) => Promise<void>;
  onHeaders?: (headers: Headers) => Promise<void>;
  /** 쿠키를 쓸 수 있는 Route Handler에서만 사용한다. Server Action은 자동 판별한다. */
  allowAuthRefresh?: boolean;
  /** SSE 응답 본문을 읽지 않고 호출자에게 전달한다. */
  eventStream?: boolean;
}

/**
 * BE 로 요청을 보내고 봉투를 벗겨 데이터만 돌려준다.
 *
 * - 성공: `data` 를 반환
 * - 실패: `ApiError` throw (상위에서 toast·redirect 등으로 처리)
 */
export function api(path: string, init: ApiInit & { eventStream: true }): Promise<Response>;
export function api<T>(path: string, init?: ApiInit): Promise<T>;
export function api<T>(path: string, init: ApiInit = {}): Promise<T | Response> {
  return requestApi<T>(path, init, 0);
}

async function requestApi<T>(path: string, init: ApiInit, attempt: number): Promise<T | Response> {
  const { json, body, timeoutMs, accessToken: suppliedToken, headers, onResponse, onHeaders, allowAuthRefresh, eventStream, signal, ...rest } = init;
  const authenticated = !isAuthMock && !path.startsWith("/api/v1/auth/");
  const jar = authenticated ? await cookies() : null;
  const accessToken = suppliedToken ?? jar?.get(process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken")?.value;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const outgoingHeaders = new Headers(headers);
    if (!outgoingHeaders.has("Accept")) outgoingHeaders.set("Accept", eventStream ? "text/event-stream" : "application/json");
    if (json !== undefined) outgoingHeaders.set("Content-Type", "application/json");
    if (accessToken) outgoingHeaders.set("Authorization", `Bearer ${accessToken}`);
    const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      ...rest,
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      headers: outgoingHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
    });

    await onHeaders?.(res.headers);
    if (eventStream && res.ok && res.body && res.headers.get("content-type")?.startsWith("text/event-stream")) return res;
    const envelope = await res.json().catch(() => null) as ApiEnvelope<T> | null;
    if (!eventStream && res.ok && envelope?.success) {
      await onResponse?.(envelope.data, res.headers);
      return envelope.data;
    }
    const failure = envelope && !envelope.success ? envelope.error : null;
    if (authenticated && res.status === 401 && failure?.code === "AUTH_ACCESS_TOKEN_EXPIRED" && attempt === 0) {
      const incoming = await requestHeaders();
      if (allowAuthRefresh || incoming.has("next-action")) {
        const { refreshAuthSession, clearAuthTokens } = await import("@/features/auth/session");
        let token: string;
        try { token = await refreshAuthSession(); }
        catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.code === "AUTH_ACCOUNT_SUSPENDED")) {
            await clearAuthTokens();
            redirect(getAuthLoginHref(error.code === "AUTH_ACCOUNT_SUSPENDED" ? error.code : "session", getSuspendedUntil(error.data), error.traceId));
          }
          throw error;
        }
        return requestApi<T>(path, { ...init, accessToken: token }, 1);
      }
      // Server Component는 쿠키를 쓸 수 없어 페이지/BFF 왕복 후 조회를 재실행한다.
      if (!jar?.has("moa_auth_retry")) {
        const returnPath = getAuthReturnPath(incoming.get("x-moa-request-path")) ?? "/workspaces";
        redirect(`/auth/callback?reason=expired&returnPath=${encodeURIComponent(returnPath)}`);
      }
    }
    throw new ApiError(
      res.status,
      failure?.message ?? "서버 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
      failure?.code ?? "API_RESPONSE_INVALID",
      failure?.errors,
      failure?.traceId,
      failure?.data,
    );
  } finally {
    clearTimeout(timeout);
  }
}
