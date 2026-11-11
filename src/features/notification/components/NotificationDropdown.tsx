"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/db";

import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "../actions";
import { iconForNotificationKind } from "../lib/icon-for-kind";
import { formatRelativeTime } from "../lib/relative-time";

interface Props {
  initialNotifications: readonly Notification[];
  initialUnreadCount: number;
}

/**
 * 헤더의 종 아이콘 + 알림 드롭다운.
 *
 * ⚠️ 서버에서 받은 알림을 **낙관적으로** 읽음 처리한다 — 클릭 즉시 로컬 미읽음 수가
 *    줄어들고, Server Action 이 뒤에서 조용히 커밋한다. 실패 롤백은 다음 revalidate 로
 *    자연 복구된다 (이 작업은 되돌릴 거리가 적어 실패시 토스트 없이 다음 조회로 맡긴다).
 * ⚠️ 알림을 **누르면** 읽음 처리하고 targetUrl 로 이동한다. 읽음만 하고 이동은 안 하는
 *    별도 버튼은 두지 않는다 — 요구 2단계가 하나의 클릭 안에 담겨야 사용자가 "읽은 건
 *    확인했다" 로 느낀다.
 */
export function NotificationDropdown({
  initialNotifications,
  initialUnreadCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  const RECENT_LIMIT = 8;
  const recent = items.slice(0, RECENT_LIMIT);

  const markOneRead = (id: number) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id && n.readAt === null
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    startTransition(() => {
      void markNotificationAsReadAction({ notificationId: id });
    });
  };

  const handleItemClick = (n: Notification) => {
    if (n.readAt === null) markOneRead(n.id);
    if (n.targetUrl) {
      setOpen(false);
      router.push(n.targetUrl);
    }
  };

  const handleMarkAllRead = () => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)),
    );
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsAsReadAction();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `알림 (미읽음 ${unread}개)` : "알림"}
          className="relative"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="bg-danger absolute top-1 right-1 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="bg-surface w-[360px] p-0"
      >
        <div className="border-border-soft flex items-center justify-between border-b px-4 py-3">
          <div className="text-foreground text-sm font-semibold">알림</div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unread === 0}
            className="text-accent-teal text-xs font-medium hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            모두 읽음
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="text-muted-foreground px-4 py-10 text-center text-sm">
            새 알림이 없습니다.
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {recent.map((n) => {
              const Icon = iconForNotificationKind(n.kind);
              const isUnread = n.readAt === null;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "hover:bg-secondary flex w-full items-start gap-3 border-b border-border-soft px-4 py-3 text-left transition-colors",
                      isUnread && "bg-light",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        isUnread ? "bg-accent-teal text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-foreground text-sm leading-snug",
                          isUnread ? "font-semibold" : "font-normal",
                        )}
                      >
                        {n.message}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {formatRelativeTime(n.createdAt)}
                      </div>
                    </div>
                    {isUnread && (
                      <span
                        aria-hidden="true"
                        className="bg-danger mt-2 size-2 shrink-0 rounded-full"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-border-soft flex items-center justify-center border-t px-4 py-3">
          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="text-muted-foreground text-xs hover:text-foreground"
          >
            알림 설정
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
