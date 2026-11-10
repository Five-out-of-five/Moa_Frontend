import { Sidebar } from "@/components/common/Sidebar";
import { TopBar } from "@/components/common/TopBar";

/**
 * (shell) 라우트 그룹 — 로그인 뒤 전역 공용 레이아웃.
 *
 * ⚠️ 레이아웃 상수(폭·높이) 는 전부 CSS 변수(`--header-height`, `--sidebar-width`) 로만
 *    참조한다. 숫자 하드코딩 금지 — 디자인 토큰이 바뀌면 `globals.css` 한 곳만 고치면
 *    전 화면에 반영돼야 한다.
 *
 * ⚠️ 본문은 `TopBar` 높이만큼 위를 비워 두고 시작한다(`pt-[var(--header-height)]`).
 *    `TopBar` 가 `fixed` 라서 비워 두지 않으면 콘텐츠 상단이 가려진다.
 */
export default function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background min-h-dvh">
      <TopBar />
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
