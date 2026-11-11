import { ChartNoAxesColumn, Search, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  NotificationBellFallback,
  NotificationBellLoader,
} from "@/features/notification/components/NotificationBellLoader";

/**
 * 전역 헤더 — 로그인 뒤 모든 화면의 상단 바.
 *
 * ⚠️ 높이는 `--header-height` (68px) 고정. `(shell)` 레이아웃의 본문이 이 높이를 비워 두고
 *    시작하도록 `pt-[var(--header-height)]` 를 레이아웃이 깐다.
 * ⚠️ 알림 로딩은 **자체 Suspense 경계** 안에서 한다. 알림 요청이 느리거나 실패해도
 *    헤더(검색·프로필) 와 쉘 본문은 영향 없이 그려진다.
 */
export function Header() {
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

        <Suspense fallback={<NotificationBellFallback />}>
          <NotificationBellLoader />
        </Suspense>

        <Button type="button" variant="ghost" size="icon" aria-label="내 프로필">
          <User className="size-5" />
        </Button>
      </div>
    </header>
  );
}
