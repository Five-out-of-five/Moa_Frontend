# CLAUDE.md — MOA (팀 애자일 그룹웨어) FE · 팀 공용 · 린

> 📌 살아있는 문서. **기술규칙=안정 / API·DB=스펙 확정 후 갱신.**
> **한 줄:** 회의·보드·업무·투표를 **방(room)** 에 모으고, 흐름을 **대시보드** 로 본다.
> **스택:** Next.js 15 App Router · React 19 · TS · Tailwind 4 · shadcn/ui 2. 데이터=**Server-First + Server Action + BFF + httpOnly 쿠키**.
> **⚠️ 로그인 뒤 사내 도구다.** 공개 페이지는 랜딩·로그인뿐. SEO·OG 는 랜딩에만.

## 핵심 4원칙

1. **서버우선:** 조회=Server Component, `"use client"` 는 상호작용 잎사귀(버튼·폼·DnD)만.
2. **변경(CUD)=Server Action + BFF:** 브라우저 → Next 서버(액션) → BE. 끝나면 `revalidatePath`. **토큰이 브라우저로 안 나간다.**
3. **정직한 목업:** 목 데이터는 API 명세의 success 예시 그대로. 모든 화면 **loading / error / empty** 필수.
4. **⚡최적화=처음부터:** 이미지 `next/image`·폰트 `next/font`·무거운거 `next/dynamic`·시맨틱 태그. 쓰는 순간 적용.

## 데이터 소스 분기 (isMock) ⭐

- `src/mocks/config.ts` 의 `isMock` 하나로 전 서비스가 목 ↔ 실서버 를 왔다 갔다 한다.
- 분기는 **각 도메인의 `server.ts` / `actions.ts` 에서만** 한다.
  ```ts
  // src/features/mood/server.ts
  export async function listTodayMoods(roomId: number) {
    if (isMock) return moodStatuses.filter((m) => m.roomId === roomId && today());
    return api<MoodStatus[]>(`/api/v1/rooms/${roomId}/moods?date=today`);
  }
  ```
- **컴포넌트·훅은 `isMock` 을 import 하지 않는다.** 알기 시작하면 실서버로 전환하는 날 전 화면을 고쳐야 한다.
- `.env.local` 에 `NEXT_PUBLIC_USE_MOCK=false` 를 지정하면 실 API 로 간다. 기본은 목.

## 폴더·네이밍

```
src/
├─ app/                 # Next.js App Router
│  ├─ (public)/         # 로그인 전 (랜딩·로그인·약관)
│  ├─ (shell)/          # 로그인 후 공통 셸 (사이드바·헤더)
│  │  ├─ rooms/[roomId]/
│  │  └─ account/
│  └─ api/              # BFF Route Handlers (WebSocket·SSE 중계)
├─ components/
│  ├─ ui/               # shadcn 원소
│  ├─ common/           # Header, Sidebar 등 공용 블록
│  └─ domain/           # 도메인 전용 재사용 (RoomCard 등)
├─ features/            # 도메인 모듈
│  ├─ room/             # 방 - server.ts, actions.ts, components/, types.ts
│  ├─ widget/           # 대시보드 배치
│  ├─ mood/             # 상태값 위젯
│  ├─ idea/             # 아이디어보드 위젯
│  ├─ task/             # 업무보드 + 진척도 위젯
│  ├─ vote/             # 투표 위젯
│  ├─ briefing/         # 캐치업 브리핑 위젯
│  ├─ mediation/        # 중재 위젯
│  ├─ chat/             # 채팅
│  ├─ auth/             # 소셜 로그인·약관 동의
│  └─ account/          # 계정 설정
├─ mocks/               # 목 데이터
│  ├─ config.ts         # isMock
│  └─ db.ts             # 결정적 시드 인메모리 저장소
├─ lib/                 # api.ts (BFF), endpoints.ts, permission.ts, utils.ts
├─ hooks/
├─ types/
│  └─ db.ts             # DB 스키마 거울 (46 테이블 중 FE 가 보는 것)
├─ constants/
└─ styles/
```

- 컴포넌트 `PascalCase` · 훅 `useXxx` · 액션 `xxxAction` · 상수 `UPPER_SNAKE`
- boolean `is/has/should` · 핸들러 `handle~` · prop `on~`
- 200줄 넘으면 분리. 로직 = 커스텀 훅. `enum` 금지 (`as const`)

## 권한 — 축이 2개다 ⭐

> 서비스 전체 권한(`account.role`) 과 방 안 권한(`room_member.role`) 은 **독립**이다.

- **① 방 안 역할:** `OWNER` / `MEMBER` — 방 설정·추방·방 삭제는 OWNER 만.
- **② 서비스 역할:** `USER` / `ADMIN` — 관리자 페이지 접근용. OWNER 와 상관없음.
- **③ 리소스 소유권:** 내 카드·내 업무·내 상태값. 역할과 무관하게 작성자만 수정·삭제.
- 검증은 **서버에서.** Server Action·BFF 에서 반드시 재검사.
- 판정은 `lib/permission.ts` 한 곳.

## 라우트 그룹 (초기 안)

```
app/
├─ (public)/ / /login /signup/[ticket] /terms /privacy
├─ (shell)/  /rooms/[roomId]        방 대시보드 (위젯 배치)
│           /rooms/[roomId]/boards/idea  아이디어 보드 전체 보기
│           /rooms/[roomId]/boards/task  업무 보드 전체 보기
│           /rooms/[roomId]/votes
│           /rooms/[roomId]/chat
│           /account                 계정 설정
│           /workspaces              방 관리 (가입·생성)
└─ (admin)/ /admin/**                ROLE_ADMIN 전용
```

- **방 ID 는 URL 에 붙인다** (`/rooms/:roomId`). 소속 검사는 서버에서.
- 소속 자원은 **같은 roomId 범위 안에** 둔다 (`/rooms/:roomId/votes/:voteId`).

## 렌더링·데이터

- 조회 = Server Component `async/await`. useEffect 페칭 금지.
- cache: `force-cache`/`no-store`/`revalidate` 명시.
- 폼 = `useActionState` + `useFormStatus`. multipart = `Content-Type` 수동 설정 금지.
- `use client` 최소화. 데이터는 props 로. client 가 server import 금지 — 대신 `children`.
- 인증 = **httpOnly 쿠키**. `localStorage` 토큰 금지.
- 알림·브리핑 = **WebSocket(STOMP) + SSE 백업**. BFF 가 중계하고 토큰을 주입한다.
- 변경 결과 피드백 = **토스트** (shadcn `sonner`, `<Toaster />` 는 루트 레이아웃 1개).
  - ❌ 폼 검증 오류 → 필드 인라인
  - ❌ 파괴적 작업 확인 → AlertDialog
  - ❌ 페이지 전체 실패 → `error.tsx`

## 공용 API 봉투 — 매퍼 1곳 ⭐

- 성공: `{ success: true, data: ... }`
- 실패: `{ success: false, error: { code, message, errors? } }`
- **봉투를 벗기는 일은 `src/lib/api.ts` 한 곳.** 컴포넌트는 `code` 로 분기할 뿐 봉투 모름.
- `message` 는 **화면에 그대로 띄울 한국어 문장.** 코드로 조립하지 않는다.

## 위젯 — 7종 고정 (명세)

| widgetType       | 화면               | 부르는 API                           | 담당 테이블          |
| ---------------- | ------------------ | ------------------------------------ | -------------------- |
| MOOD             | 상태값             | `GET /rooms/{id}/moods`              | `mood_status`        |
| IDEA_BOARD       | 아이디어 보드      | `GET /rooms/{id}/idea-cards`         | `idea_card`          |
| TASK_BOARD       | 업무 보드          | `GET /rooms/{id}/tasks`              | `task`               |
| PROGRESS         | 진척도             | `GET /rooms/{id}/tasks/progress`     | `task` 집계          |
| VOTE             | 투표               | `GET /rooms/{id}/votes`              | `vote`               |
| CATCHUP_BRIEFING | 캐치업 브리핑      | `GET /rooms/{id}/briefing`           | `board_event`        |
| MEDIATION        | 중재               | `GET /rooms/{id}/conflicts`          | `card_conflict`      |

- **카드·업무·투표는 위젯 ID 를 FK 로 갖지 않는다.** 전부 `room_id` 기준.
  위젯 종류 ↔ 데이터 테이블 대응은 **코드로만** 안다 (보여 줄 테이블은 코드에 박혀 있다).
- 같은 종류 위젯은 방당 1개 (`uk_room_widget_type`). 위젯을 지워도 데이터는 남는다.

## 디자인 시스템

- Tailwind 4 + shadcn/ui 2. 컬러 토큰은 `src/app/globals.css` (`oklch`).
- **직접 색상 hex 하드코딩 금지.** `bg-primary` / `text-destructive` 등 토큰만 쓴다.
- 1440 기준 설계 + 반응형 여지. 모바일은 iPad 이후 2차.

## 민감 파일 정책

- `.env`, `*.pem`, `*.key` 등은 **커밋 금지.** `.gitignore` 로 1차 차단.
- 공유 필요하면 `.env.example` 에 **값 없는 키 목록만** 둔다.
- `.gitignore` 는 프로젝트 첫 커밋에 올린다 (민감 파일 유입 선제 차단).

## Git 전략

- 브랜치: `feat/<도메인>-<기능>#<이슈>`. base = `develop` (없으면 임시로 `main`).
- PR 템플릿: 타입·영역·역할·체크리스트·리뷰 포인트.
- CodeRabbit 자동 요약 + 리뷰 포인트 명시.
- BE 협업: PR 본문에 `[확인] BACKEND PR #N 머지 완료` 로 참조.

## AI 코드 작성 규칙 (Claude · Codex 공용)

- **이 문서를 매 세션 먼저 읽는다.** 따로 질문해 사용자에게 재확인하지 말 것.
- 변수·함수·커밋 메시지는 **한국어 + 코드 식별자는 영어**.
- 주석은 "무엇을" 설명하지 않는다 — "왜" 가 비명이 되는 곳에만.
- `any` 금지 (`unknown` + 가드).
- `console.log` 는 커밋하지 않는다 (디버깅은 TODO 주석으로 임시 표시).
- 결정이 애매하면 `DECISIONS.md` 에 ⚠️ 와 날짜 붙여 기록한다.

관련 문서: [AGENTS.md](./AGENTS.md) (Codex 용 · 이 문서와 동일 내용)
