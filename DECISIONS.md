# DECISIONS.md — 팀이 정한 것·미정·정정

> 📌 결정은 **날짜와 함께** 기록한다. 결정이 바뀌면 지우지 않고 `⚠️ YYYY-MM-DD 정정` 으로 덧붙인다.

## 2026-11-05 · 초기 FE 세팅

### 정함
- **스택**: Next.js 15 + React 19 + TS + Tailwind 4 + shadcn/ui 2 + npm
- **목 ↔ 실서버 분기**: `src/mocks/config.ts` 의 `isMock` 하나. `NEXT_PUBLIC_USE_MOCK=false` 로 끈다.
- **민감 파일 정책**: `.gitignore` 선 push → 환경 파일 후 작업
- **AI 코드 작성 규칙 공유**: `CLAUDE.md` + `AGENTS.md` 동일 내용 두 파일

### 미정
- **디자인 토큰 (Navy Teal Pro)** 을 색 토큰으로 어떻게 매핑할지 — Figma Make 결과물 색상 추출 후 결정
- **WebSocket 연결 전략** (방 입장 시 1개 vs 전역 1개) — BE 와 협의 필요
- **TooltipProvider delayDuration** — 지금 200ms 로 두었으나 UX 리뷰 후 조정

### 추후 보강
- 라우트 그룹 `(public)` / `(shell)` / `(admin)` 실제 분리
- 도메인별 `actions.ts` 전수 작성 (`mood/actions.ts` 만 샘플로 깔림)
- `src/components/common/Sidebar` · `Header` 구현
- `src/lib/error-tag.ts` · `src/lib/loki.ts` (관측) 이식
