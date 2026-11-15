# MOA Frontend

> 팀 **오점만점 (Five out of Five)** · MOA (Mind On Agile) 프론트엔드
> Next.js 15 · React 19 · TypeScript · Tailwind 4 · shadcn/ui

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

- Next.js 15 (App Router · Server Components · Server Actions)
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

## 📌 프로젝트 소개

**MOA(Mind On Agile)**는 팀의 회의, 아이디어, 업무, 투표를 **방**에 모으고, 진행 상황을 **대시보드**에서 확인할 수 있도록 만드는 팀 협업 서비스입니다.

### 주요 기능

| 기능 | 설명 |
| --- | --- |
| 방 · 대시보드 | 방을 만들거나 참여하고, 팀에 필요한 위젯을 대시보드에 배치합니다. |
| 상태값 | 팀원이 현재 상태를 공유합니다. |
| 아이디어 보드 | 팀의 아이디어를 카드로 모아 확인합니다. |
| 업무 보드 · 진척도 | 업무 상태와 전체 진행 상황을 확인합니다. |
| 투표 | 팀에서 결정할 안건을 올리고 의견을 모읍니다. |
| 캐치업 브리핑 | 자리를 비운 사이에 발생한 변경 사항을 확인합니다. |
| 중재 | 카드에서 발생한 충돌을 확인하고 조율합니다. |

## 🛠️ 개발 환경

- Node.js 22 이상
- npm 10 이상
- 환경변수 키 목록은 [`.env.example`](./.env.example)에서 확인합니다.
- 실서버에 연결할 때는 `.env.local`에서 `NEXT_PUBLIC_USE_MOCK=false`로 설정하고 `BACKEND_BASE_URL`을 지정합니다.

PowerShell에서는 빠른 시작의 `cp` 명령을 아래와 같이 실행할 수 있습니다.

```powershell
Copy-Item .env.example .env.local
```

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run build` | 배포용 빌드 |

## 계정 및 알림 설정

- 헤더 프로필 메뉴의 **계정 및 프로필**(`/account`)에서 기본 이름을 수정하고 연결 계정과 참여 중인 방을 확인할 수 있습니다.
- **알림 설정**(`/account/settings`)에서 전역 수신 그룹을 저장합니다. 관리자·시스템 그룹은 항상 켜져 있습니다.
- 목 모드에서 기본 이름, 전역 알림 설정, 방 나가기 변경은 서버를 재시작할 때 초기화됩니다. 계정 탈퇴 메뉴에서는 탈퇴 조건을 확인할 수 있습니다.
- 실서버의 이름 변경·방 나가기·전역 알림 설정과 실제 알림 전달 연동은 BE API 계약 확인 후 연결합니다.

## 방별 프로필 설정

목 모드에서 방에 입장한 뒤 채팅 사이드바 하단의 내 프로필을 선택하면 닉네임, 직책, 이미지를 수정할 수 있습니다. 최초 참여 시 저장한 닉네임과 이미지를 이어서 사용하며, 변경 사항은 해당 방에만 적용됩니다. 목 저장 상태는 서버 재시작 시 초기화됩니다.

## 🌿 브랜치 명명 규칙

기능 개발과 UI 작업에는 `feat/`를 사용합니다. 이슈를 먼저 등록한 뒤 발급된 번호를 브랜치명 끝에 붙입니다.

```text
feat/<도메인>-<작업내용>#<이슈번호>
```

| 작업 유형 | 접두어 | 브랜치 예시 |
| --- | --- | --- |
| 기능 · UI | `feat` | `feat/auth-ui#12` |
| 버그 수정 | `fix` | `fix/vote-submit#13` |
| 리팩터링 | `refactor` | `refactor/auth-action#14` |
| 문서 | `docs` | `docs/readme-guide#15` |
| 테스트 | `test` | `test/room-permission#16` |
| 설정 · 인프라 | `chore` | `chore/eslint-config#17` |
| 릴리스 | `release` | `release/v1-0-0#18` |
