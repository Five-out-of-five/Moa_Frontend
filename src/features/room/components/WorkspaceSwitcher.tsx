"use client";

import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Room } from "@/types/db";

interface Props {
  rooms: readonly Room[];
  fallbackRoomId: number | null;
}

/**
 * 헤더 좌측의 **워크스페이스(=방) 전환** 드롭다운. Figma Make 의 로고 옆 드롭다운.
 *
 * ⚠️ 현재 선택 상태는 URL 의 `/rooms/{roomId}` 세그먼트로 판단한다 — 서버는 어느 방을 보고
 *    있는지 모른다. `/rooms` 바로 밑이면 Account.lastRoomId 로 fallback.
 */
export function WorkspaceSwitcher({ rooms, fallbackRoomId }: Props) {
  const pathname = usePathname();
  const currentId = useMemo(() => {
    const match = pathname.match(/^\/rooms\/(\d+)(?:\/|$)/);
    if (match) return Number(match[1]);
    return fallbackRoomId;
  }, [pathname, fallbackRoomId]);

  const current = rooms.find((r) => r.id === currentId) ?? rooms[0] ?? null;

  if (!current) {
    return (
      <Link
        href="/workspaces"
        className="text-brand text-sm font-medium hover:underline"
      >
        워크스페이스 만들기
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-secondary flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-sm transition-colors",
          "focus:ring-ring focus:outline-none focus-visible:ring-2",
        )}
        aria-label="워크스페이스 선택"
      >
        <WorkspaceAvatar name={current.name} />
        <span className="text-foreground max-w-[220px] truncate font-medium">
          {current.name}
        </span>
        <ChevronDown className="text-muted-foreground size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-surface w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          워크스페이스
        </DropdownMenuLabel>
        {rooms.map((room) => {
          const active = room.id === current.id;
          return (
            <DropdownMenuItem key={room.id} asChild>
              <Link
                href={`/rooms/${room.id}`}
                className="flex cursor-pointer items-center gap-2"
              >
                <WorkspaceAvatar name={room.name} />
                <span className="flex-1 truncate">{room.name}</span>
                {active && <Check className="text-brand size-4" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces" className="flex cursor-pointer items-center gap-2">
            <Settings2 className="text-muted-foreground size-4" />
            <span>워크스페이스 관리</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/workspaces/new" className="flex cursor-pointer items-center gap-2">
            <Plus className="text-muted-foreground size-4" />
            <span>새 워크스페이스 만들기</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceAvatar({ name }: { name: string }) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="bg-brand flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[11px] font-semibold text-white"
    >
      {initial}
    </span>
  );
}

export function WorkspaceSwitcherFallback() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="bg-muted size-6 animate-pulse rounded-[var(--radius-control)]" />
      <span className="bg-muted h-4 w-28 animate-pulse rounded" />
    </div>
  );
}
