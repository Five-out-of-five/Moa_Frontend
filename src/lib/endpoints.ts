/**
 * BE 호출 베이스 URL 과 경로 상수.
 *
 * ⚠️ 서버 전용 환경변수(`BACKEND_BASE_URL`)는 **서버 사이드에서만** 쓴다.
 *    브라우저 번들에 들어가면 안 되므로 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
 */

export const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ?? "http://localhost:8080";

export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

/** 호출 기본 타임아웃 — 각 호출에서 덮어쓸 수 있다. */
export const DEFAULT_TIMEOUT_MS = Number(
  process.env.API_DEFAULT_TIMEOUT_MS ?? "10000",
);
