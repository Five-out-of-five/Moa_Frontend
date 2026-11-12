"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Notification, NotificationGroup } from "@/types/db";

import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "../actions";
import {
  NOTIFICATION_GROUP_LABEL,
  NOTIFICATION_GROUP_ORDER,
} from "../lib/category-for-kind";
import { iconForNotificationGroup } from "../lib/icon-for-kind";
import { formatRelativeTime } from "../lib/relative-time";
import { targetUrlOfNotification } from "../lib/target-url";

interface Props {
  /** 전체 최근 N개 — "전체" 탭에서 그대로 쓴다 */
  initialRecent: readonly Notification[];
  /** 읽지 않음 전용 응답 — "읽지 않음" 탭에서 쓴다 (`recent` 와 분리해, size 초과 미읽음이 숨지 않도록) */
  initialUnread: readonly Notification[];
  /** 전역 미읽음 카운트 — 뱃지에 사용. `initialUnread.length` 와 다를 수 있다 */
  initialUnreadCount: number;
}

type TabKey = "all" | "unread";

/**
 * 헤더의 종 아이콘 + 알림 드로워 (우측 슬라이드).
 *
 * ⚠️ 응답 shape 는 명세 `NotificationResponse` 기준: `group` 으로 섹션 분류, `read`(boolean)
 *    로 읽음 표시, `title + content` 2줄, 이동 목적지는 `room + targetType + targetId` 조합을
 *    FE 가 조립해서 사용 (`lib/target-url.ts`).
 *
 * ⚠️ 서버에서 받은 알림을 **낙관적으로** 읽음 처리한다. 클릭 즉시 로컬 미읽음 수가 줄고,
 *    Server Action 이 뒤에서 커밋한다. 실패 시 이전 state 로 롤백한다. 드로워가 닫혀 있을
 *    때만 props 를 재동기해 다른 세션/탭의 변화를 흡수한다 (열려 있는 동안엔 사용자가
 *    보고 있는 목록을 흔들지 않음).
 *
 * ⚠️ 알림을 **누르면** 읽음 처리하고 targetType+targetId 로 이동한다.
 */
export function NotificationDropdown({
  initialRecent,
  initialUnread,
  initialUnreadCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(initialRecent);
  const [unreadList, setUnreadList] = useState(initialUnread);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [tab, setTab] = useState<TabKey>("all");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) return;
    setRecent(initialRecent);
    setUnreadList(initialUnread);
    setUnreadCount(initialUnreadCount);
  }, [initialRecent, initialUnread, initialUnreadCount, open]);

  // "전체" 탭은 최근 50 만, "읽지 않음" 탭은 서버가 돌려준 unread 전체를 쓴다.
  // 이렇게 두 소스를 분리하면 size 를 초과한 미읽음이 "읽지 않음" 탭에서 숨지 않는다.
  const visible = useMemo(
    () => (tab === "unread" ? unreadList : recent),
    [recent, unreadList, tab],
  );

  const grouped = useMemo(() => {
    const map = new Map<NotificationGroup, Notification[]>();
    for (const n of visible) {
      const bucket = map.get(n.group);
      if (bucket) bucket.push(n);
      else map.set(n.group, [n]);
    }
    return NOTIFICATION_GROUP_ORDER.filter((g) => map.has(g)).map((group) => ({
      group,
      items: map.get(group)!,
    }));
  }, [visible]);

  const markOneRead = (id: number) => {
    const prevRecent = recent;
    const prevUnreadList = unreadList;
    const prevUnreadCount = unreadCount;
    setRecent(
      prevRecent.map((n) =>
        n.notificationId === id && !n.read ? { ...n, read: true } : n,
      ),
    );
    setUnreadList(prevUnreadList.filter((n) => n.notificationId !== id));
    setUnreadCount(Math.max(0, prevUnreadCount - 1));
    startTransition(() => {
      markNotificationAsReadAction({ notificationId: id }).catch(() => {
        setRecent(prevRecent);
        setUnreadList(prevUnreadList);
        setUnreadCount(prevUnreadCount);
      });
    });
  };

  const handleItemClick = (n: Notification) => {
    if (!n.read) markOneRead(n.notificationId);
    setOpen(false);
    router.push(targetUrlOfNotification(n));
  };

  const handleMarkAllRead = () => {
    const prevRecent = recent;
    const prevUnreadList = unreadList;
    const prevUnreadCount = unreadCount;
    setRecent(prevRecent.map((n) => (n.read ? n : { ...n, read: true })));
    setUnreadList([]);
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsAsReadAction().catch(() => {
        setRecent(prevRecent);
        setUnreadList(prevUnreadList);
        setUnreadCount(prevUnreadCount);
      });
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0 ? `알림 (미읽음 ${unreadCount}개)` : "알림"
          }
          className="relative"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="bg-danger absolute top-1 right-1 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-surface flex w-full flex-col gap-0 p-0 sm:max-w-[400px]"
      >
        <SheetHeader className="border-border-soft gap-1 border-b px-5 py-4">
          <SheetTitle className="text-foreground text-lg font-semibold">
            알림
          </SheetTitle>
          <SheetDescription className="text-muted-foreground mt-0.5 text-xs">
            방마다 쌓인 소식을 한눈에 확인하세요.
          </SheetDescription>
          {/* ⚠️ 알림 설정 아이콘은 /account/notifications 전역·방별 설정 페이지가 생길 때 추가한다. */}
        </SheetHeader>

        <div className="border-border-soft flex items-center justify-between border-b px-5 py-2">
          <div
            role="tablist"
            aria-label="알림 필터"
            className="flex items-center gap-1"
          >
            <TabButton
              active={tab === "all"}
              onClick={() => setTab("all")}
              label="전체"
            />
            <TabButton
              active={tab === "unread"}
              onClick={() => setTab("unread")}
              label="읽지 않음"
              badge={unreadCount}
            />
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="text-accent-teal hover:text-brand disabled:text-muted-foreground inline-flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed"
          >
            <CheckCheck className="size-3.5" />
            모두 읽음
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            grouped.map(({ group, items: groupItems }) => (
              <section key={group}>
                <h3 className="text-muted-foreground px-5 pt-4 pb-1.5 text-xs font-medium">
                  {NOTIFICATION_GROUP_LABEL[group]}
                </h3>
                <ul>
                  {groupItems.map((n) => (
                    <NotificationItem
                      key={n.notificationId}
                      notification={n}
                      onClick={() => handleItemClick(n)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-secondary text-brand"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const Icon = iconForNotificationGroup(notification.group);
  const isUnread = !notification.read;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "border-border-soft hover:bg-secondary flex w-full items-start gap-3 border-b px-5 py-3 text-left transition-colors last:border-b-0",
          isUnread && "bg-background",
        )}
      >
        <span
          aria-hidden="true"
          className="bg-secondary text-brand mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p
              className={cn(
                "text-foreground flex-1 text-sm leading-snug",
                isUnread ? "font-semibold" : "font-medium",
              )}
            >
              {notification.title}
            </p>
            {isUnread && (
              <span
                aria-label="읽지 않음"
                className="bg-accent-teal mt-1.5 size-1.5 shrink-0 rounded-full"
              />
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
            {notification.content}
          </p>
          <p className="text-muted-foreground/80 mt-1 text-[11px]">
            {notification.room.name} · {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </button>
    </li>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Bell className="size-8 opacity-40" aria-hidden="true" />
      <p className="text-sm">
        {tab === "unread" ? "읽지 않은 알림이 없습니다." : "새 알림이 없습니다."}
      </p>
    </div>
  );
}
