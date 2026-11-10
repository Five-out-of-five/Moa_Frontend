"use client";

import {
  Bell,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 이 경로를 **접두어로** 포함하면 활성화 — 하위 라우트에서도 같은 항목이 하이라이트된다. */
  matchPrefix?: string;
}

const NAV: readonly NavItem[] = [
  { href: "/rooms", label: "방", icon: Users, matchPrefix: "/rooms" },
  {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    matchPrefix: "/dashboard",
  },
  { href: "/chat", label: "채팅", icon: MessageSquare, matchPrefix: "/chat" },
  {
    href: "/notifications",
    label: "알림",
    icon: Bell,
    matchPrefix: "/notifications",
  },
  { href: "/account", label: "계정", icon: Settings, matchPrefix: "/account" },
] as const;

/**
 * 좌측 사이드바 — 로그인 뒤 전역 셸의 네비게이션.
 *
 * ⚠️ 폭은 `--sidebar-width` (228px) 고정. 사이드바 **내부 스크롤** 은 둬도 되지만, 전체 셸은
 *    고정 레이아웃이라 여기서 `h-screen` 을 쓰지 않는다 — `(shell) layout` 이 `flex` 를 짜고,
 *    사이드바는 그 자리를 채우기만 한다.
 *
 * ⚠️ 활성화 판정은 `usePathname()` 기반이라 **클라이언트 컴포넌트** 로 둔다. 서버에서도 render
 *    되지만 "지금 어느 항목?" 은 브라우저 pathname 이 정본이다.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주 네비게이션"
      className="bg-surface flex h-[calc(100vh-var(--header-height))] w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border px-3 py-6"
    >
      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, matchPrefix }) => {
          const isActive = matchPrefix
            ? pathname.startsWith(matchPrefix)
            : pathname === href;

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
