import "server-only";

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
  };
}

export type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeFailure;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly fields?: ApiErrorField[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiInit extends Omit<RequestInit, "body"> {
  /** JSON 으로 직렬화해 보낼 본문 */
  json?: unknown;
  /** 호출별 타임아웃 (ms) — 기본 {@link DEFAULT_TIMEOUT_MS} */
  timeoutMs?: number;
  /** Access Token — 로그인 전 화면이면 넘기지 않는다 */
  accessToken?: string;
}

/**
 * BE 로 요청을 보내고 봉투를 벗겨 데이터만 돌려준다.
 *
 * - 성공: `data` 를 반환
 * - 실패: `ApiError` throw (상위에서 toast·redirect 등으로 처리)
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, timeoutMs, accessToken, headers, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });

    const envelope = (await res.json()) as ApiEnvelope<T>;
    if (envelope.success) {
      return envelope.data;
    }
    throw new ApiError(
      res.status,
      envelope.error.message,
      envelope.error.code,
      envelope.error.errors,
    );
  } finally {
    clearTimeout(timeout);
  }
}
