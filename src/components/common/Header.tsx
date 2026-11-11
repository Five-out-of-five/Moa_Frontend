import { ChartNoAxesColumn, Search, User } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/features/notification/components/NotificationDropdown";
import {
  getUnreadNotificationCount,
  listMyNotifications,
} from "@/features/notification/server";

/**
 * 전역 헤더 — 로그인 뒤 모든 화면의 상단 바.
 *
 * ⚠️ 높이는 `--header-height` (68px) 고정. `(shell)` 레이아웃의 본문이 이 높이를 비워 두고
 *    시작하도록 `pt-[var(--header-height)]` 를 레이아웃이 깐다.
 * ⚠️ 알림 초기값(목록·미읽음 수) 은 **서버에서** 받아 드롭다운에 주입한다. 드롭다운은
 *    그 초기값만 들고 열리고, 읽음 처리는 낙관적 UI + Server Action 으로 이어 간다.
 *    SSE 실시간 수신은 후속 이슈.
 */
export async function Header() {
  const [notifications, unreadCount] = await Promise.all([
    listMyNotifications(),
    getUnreadNotificationCount(),
  ]);

  return (
    <header
      className="border-border-soft bg-surface fixed inset-x-0 top-0 z-30 flex h-[var(--header-height)] items-center border-b"
      aria-label="상단 바"
    >
      {/* 사이드바 너비만큼 브랜드 영역 */}
      <div className="flex h-full w-[var(--sidebar-width)] items-center gap-2 border-r border-border px-6">
        <span
          aria-hidden="true"
          className="bg-brand grid size-8 place-items-center rounded-lg text-white"
        >
          <ChartNoAxesColumn className="size-5" strokeWidth={3} />
        </span>
        <Link
          href="/"
          className="text-foreground text-lg font-bold tracking-tight"
        >
          MOA
        </Link>
      </div>

      {/* 본문 영역: 검색 / 알림 / 프로필 */}
      <div className="flex flex-1 items-center gap-3 px-6">
        <div className="relative max-w-xl flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            placeholder="방·업무·카드 검색"
            aria-label="전역 검색"
            className="border-border bg-background focus:ring-ring h-10 w-full rounded-[var(--radius-control)] border py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </div>

        <NotificationDropdown
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
        />

        <Button type="button" variant="ghost" size="icon" aria-label="내 프로필">
          <User className="size-5" />
        </Button>
      </div>
    </header>
  );
}
