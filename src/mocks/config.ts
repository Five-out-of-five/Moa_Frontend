/**
 * 목 / 실서버 전환 스위치.
 *
 * ⚠️ BE 가 아직 개발 중이라 **지금은 목 데이터로 개발한다** (MOA 초기 FE 세팅 결정, 2026-11-05).
 *    BE 가 붙어 실 API 가 열리면 `.env.local` 에 `NEXT_PUBLIC_USE_MOCK=false` 를 지정한다.
 *    `.env` 가 비어 있거나 값이 "false" 외의 어떤 것이든 **목 모드가 켜져 있다** — 운영에서는
 *    배포 파이프라인이 반드시 `false` 를 주입하도록 한다.
 *
 * ⚠️ 분기는 **각 도메인의 `server.ts` / `actions.ts` 한 곳**에서만 한다.
 *    컴포넌트·훅은 이 값을 몰라야 한다 — 알기 시작하면 목을 끄는 날 전 화면을 고쳐야 한다.
 */
export const isMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
