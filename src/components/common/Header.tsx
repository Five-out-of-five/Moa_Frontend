import { ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import {
  ProfileMenuFallback,
} from "@/features/account/components/ProfileMenu";
import { ProfileMenuLoader } from "@/features/account/components/ProfileMenuLoader";
import {
  NotificationBellFallback,
  NotificationBellLoader,
} from "@/features/notification/components/NotificationBellLoader";
import { WorkspaceSwitcherFallback } from "@/features/room/components/WorkspaceSwitcher";
import { WorkspaceSwitcherLoader } from "@/features/room/components/WorkspaceSwitcherLoader";

/**
 * 전역 헤더 — 로그인 뒤 모든 화면의 상단 바.
 *
 * ⚠️ 높이는 `--header-height` (68px) 고정. `(shell)` 레이아웃의 본문이 이 높이를 비워 두고
 *    시작하도록 `pt-[var(--header-height)]` 를 레이아웃이 깐다.
 * ⚠️ 좌측 로고 영역 폭은 사이드바 너비(`--sidebar-width`) 와 일치시킨다 — 사이드바와의
 *    수직 라인이 어긋나지 않도록.
 * ⚠️ 워크스페이스 · 알림 · 프로필 각각 **자체 Suspense 경계** 안에서 로드한다. 한 영역의
 *    데이터 요청이 느리거나 실패해도 나머지 헤더와 쉘 본문은 그대로 그려진다.
 */
export function Header() {
  return (
    <header
      className="border-border-soft bg-surface fixed inset-x-0 top-0 z-30 flex h-[var(--header-height)] items-center border-b"
      aria-label="상단 바"
    >
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

      <div className="flex flex-1 items-center px-6">
        <Suspense fallback={<WorkspaceSwitcherFallback />}>
          <WorkspaceSwitcherLoader />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<NotificationBellFallback />}>
            <NotificationBellLoader />
          </Suspense>

          <Suspense fallback={<ProfileMenuFallback />}>
            <ProfileMenuLoader />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
