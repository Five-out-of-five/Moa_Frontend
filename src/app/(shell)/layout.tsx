import { Header } from "@/components/common/Header";
import { Sidebar } from "@/components/common/Sidebar";

/**
 * (shell) 라우트 그룹 — 로그인 뒤 전역 공용 레이아웃.
 *
 * ⚠️ 레이아웃 상수(폭·높이) 는 전부 CSS 변수(`--header-height`, `--sidebar-width`) 로만
 *    참조한다. 숫자 하드코딩 금지 — 디자인 토큰이 바뀌면 `globals.css` 한 곳만 고치면
 *    전 화면에 반영돼야 한다.
 *
 * ⚠️ 본문은 `Header` 높이만큼 위를 비워 두고 시작한다(`pt-[var(--header-height)]`).
 *    `Header` 가 `fixed` 라서 비워 두지 않으면 콘텐츠 상단이 가려진다.
 */

// 쉘 라우트는 로그인한 사용자별 데이터(워크스페이스·알림·프로필) 를 매 요청마다 서버에서
// 받아 그려야 한다. prerender 되면 헤더 로더가 실패했을 때의 "다시 시도" (router.refresh)
// 가 캐시된 에러 상태를 그대로 돌려줄 수 있어 복구가 안 된다.
export const dynamic = "force-dynamic";
export default function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background min-h-dvh">
      <Header />
      <div className="flex pt-[var(--header-height)]">
        <Sidebar />
        <main
          id="main"
          className="min-w-0 flex-1 overflow-x-hidden px-6 py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
