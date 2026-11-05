# MOA Frontend

> 팀 **오점만점 (Five out of Five)** · MOA (Mind On Agile) 프론트엔드
> Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui

## 빠른 시작

```bash
git clone https://github.com/Five-out-of-five/Moa_Frontend.git
cd Moa_Frontend
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 의 `NEXT_PUBLIC_USE_MOCK=true` 상태면 BE 없이도 목 데이터로 전 화면이 동작한다.

## 팀 문서

- [CLAUDE.md](./CLAUDE.md) · 팀 FE 린 · 기술 규칙 · 라우트 · 권한
- [AGENTS.md](./AGENTS.md) · (CLAUDE.md 와 동일 내용. Codex 용)
- [DECISIONS.md](./DECISIONS.md) · 팀이 정한 것 · 미정 · 정정 이력

## 스택

- Next.js 16 (App Router · Server Components · Server Actions)
- React 19 (`useOptimistic`, `useActionState`)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui 4
- 상태: 서버 상태는 Server Component / Server Action, UI 로컬 상태만 클라이언트
- 데이터 소스 분기: `src/mocks/config.ts` 의 `isMock`

## 폴더 구조

```
src/
├─ app/                 # Next.js App Router
│  ├─ (public)/         # 로그인 전
│  ├─ (shell)/          # 로그인 후 공통 셸
│  └─ api/              # BFF Route Handlers
├─ components/
│  ├─ ui/               # shadcn 원소 (Button, Dialog 등)
│  ├─ common/           # 공통 블록 (Header, Sidebar 등)
│  └─ domain/           # 도메인 전용 재사용 블록
├─ features/            # 도메인 모듈 (room, widget, idea, task, vote, mood, briefing, mediation...)
│  └─ <도메인>/
│     ├─ actions.ts     # Server Action (CUD)
│     ├─ server.ts      # Server Component 전용 데이터 조회
│     ├─ components/
│     └─ types.ts
├─ mocks/               # 목 데이터 · 목 응답 생성기
│  ├─ config.ts         # isMock
│  ├─ db.ts             # 목 저장소
│  └─ <도메인>.ts       # 도메인별 목 핸들러
├─ lib/                 # api.ts, endpoints.ts, permission.ts, utils.ts
├─ hooks/
├─ types/               # 전역 타입 (DB 스키마 거울)
├─ constants/
└─ styles/
```

## 민감 파일 정책

- `.env`, `*.pem`, `*.key` 등은 어떠한 변형이든 **커밋 금지**
- 공유가 필요하면 `.env.example` 에 **값 없는 키 목록만** 유지
- `.gitignore` 는 프로젝트 첫 커밋에 올린다 (민감 파일이 들어갈 위험을 먼저 차단)
