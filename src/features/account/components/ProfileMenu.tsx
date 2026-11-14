"use client";

import {
  AlertTriangle,
  ChevronDown,
  LogOut,
  RefreshCcw,
  Settings2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Account } from "@/types/db";

import { logoutAction } from "../actions";

interface Props {
  account: Account;
}

/**
 * 헤더 우측의 **프로필 드롭다운** — 아바타(이니셜) + 이름 + 역할 + 메뉴.
 *
 * ⚠️ 역할 문구는 Account.role 을 한국어로 치환한다 — DB 는 `USER` / `ADMIN` enum 이지만
 *    사용자에겐 "관리자" / "팀원" 으로 보여 준다. 커뮤니티 타이틀 (예: "제품 관리자") 은
 *    별도 프로필 필드로 들어갈 때까지 보류.
 */
export function ProfileMenu({ account }: Props) {
  const [, startTransition] = useTransition();
  const initial = account.name.slice(0, 1);
  const roleLabel = account.role === "ADMIN" ? "관리자" : "팀원";

  const handleLogout = () => {
    startTransition(() => {
      void logoutAction();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-secondary focus:ring-ring flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2"
        aria-label="프로필 메뉴"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand text-white text-xs font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="text-foreground truncate text-sm font-medium">
            {account.name}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {roleLabel}
          </span>
        </div>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-surface w-48">
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex cursor-pointer items-center gap-2">
            <UserRound className="text-muted-foreground size-4" />
            <span>계정 및 프로필</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/account/settings"
            className="flex cursor-pointer items-center gap-2"
          >
            <Settings2 className="text-muted-foreground size-4" />
            <span>알림 설정</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2"
        >
          <LogOut className="size-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 로딩 **대기 중** 전용 스켈레톤. 네트워크 요청이 완전히 실패한 상태라면
 * 이 fallback 대신 아래 `ProfileMenuErrorState` 로 떨어뜨린다 — 그래야 사용자가
 * 영원히 "로딩 중" 으로 오해하지 않는다.
 */
export function ProfileMenuFallback() {
  return (
    <div className="flex items-center gap-2 px-1.5 py-1">
      <span className="bg-muted size-8 animate-pulse rounded-full" />
      <div className="hidden flex-col gap-1 sm:flex">
        <span className="bg-muted h-3 w-16 animate-pulse rounded" />
        <span className="bg-muted h-3 w-10 animate-pulse rounded" />
      </div>
    </div>
  );
}

/**
 * 프로필 데이터 로드 실패 시의 복구형 상태 — 사용자가 **다시 시도** 하거나
 * **account-독립 로그아웃** 을 할 수 있는 축소형 드롭다운.
 *
 * ⚠️ 로그아웃은 세션 쿠키만 만료시키므로 account 조회가 실패한 상황에서도 동작한다.
 */
export function ProfileMenuErrorState() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleRetry = () => {
    router.refresh();
  };

  const handleLogout = () => {
    startTransition(() => {
      void logoutAction();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-secondary focus:ring-ring flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2"
        aria-label="프로필 메뉴 — 계정 정보를 불러오지 못했습니다"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <AlertTriangle className="size-4" />
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-surface w-56">
        <div className="text-muted-foreground px-2 py-1.5 text-xs">
          계정 정보를 불러오지 못했습니다.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleRetry}
          className="flex cursor-pointer items-center gap-2"
        >
          <RefreshCcw className="text-muted-foreground size-4" />
          <span>다시 시도</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2"
        >
          <LogOut className="size-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
