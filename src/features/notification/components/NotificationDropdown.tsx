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
import type { Notification } from "@/types/db";

import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "../actions";
import {
  categoryForNotificationKind,
  NOTIFICATION_CATEGORY_ORDER,
  type NotificationCategory,
} from "../lib/category-for-kind";
import { iconForNotificationKind } from "../lib/icon-for-kind";
import { formatRelativeTime } from "../lib/relative-time";

interface Props {
  initialNotifications: readonly Notification[];
  initialUnreadCount: number;
}

type TabKey = "all" | "unread";

/**
 * 헤더의 종 아이콘 + 알림 드로워 (우측 슬라이드).
 *
 * ⚠️ 디자인 기준: Figma Make 의 `Notifications` 화면. Popover 가 아닌 **Sheet** 로 구현한다 —
 *    알림은 한 번에 많이 들어오고 카테고리별로 훑어보는 경우가 많아, 세로로 넓은 공간이 필요하다.
 *
 * ⚠️ 서버에서 받은 알림을 **낙관적으로** 읽음 처리한다. 클릭 즉시 로컬 미읽음 수가 줄고,
 *    Server Action 이 뒤에서 커밋한다. 실패 롤백은 다음 revalidate 로 자연 복구된다
 *    (되돌릴 거리가 적어 실패시 토스트 없이 다음 조회로 맡긴다).
 *
 * ⚠️ 알림을 **누르면** 읽음 처리하고 targetUrl 로 이동한다. 읽기만 하고 안 가는 별도 버튼은
 *    두지 않는다 — 요구 2단계가 하나의 클릭 안에 담겨야 사용자가 "읽은 건 확인했다" 로 느낀다.
 */
export function NotificationDropdown({
  initialNotifications,
  initialUnreadCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [tab, setTab] = useState<TabKey>("all");
  const [, startTransition] = useTransition();

  // ⚠️ Server Action 이 revalidatePath 한 뒤 서버에서 새 알림이 넘어오면 props 가 바뀌지만
  //   useState 초기값은 그대로다. 다른 세션/탭에서 생긴 변화를 반영하려면 수동 sync 가 필요하다.
  //   open 상태에서는 사용자가 보고 있는 목록이 흔들리지 않도록 닫혀 있을 때만 재동기한다.
  useEffect(() => {
    if (open) return;
    setItems(initialNotifications);
    setUnread(initialUnreadCount);
  }, [initialNotifications, initialUnreadCount, open]);

  const visible = useMemo(
    () => (tab === "unread" ? items.filter((n) => n.readAt === null) : items),
    [items, tab],
  );

  const grouped = useMemo(() => {
    const map = new Map<NotificationCategory, Notification[]>();
    for (const n of visible) {
      const cat = categoryForNotificationKind(n.kind);
      const bucket = map.get(cat);
      if (bucket) bucket.push(n);
      else map.set(cat, [n]);
    }
    return NOTIFICATION_CATEGORY_ORDER.filter((cat) => map.has(cat)).map(
      (cat) => ({ category: cat, items: map.get(cat)! }),
    );
  }, [visible]);

  const markOneRead = (id: number) => {
    const prevItems = items;
    const prevUnread = unread;
    setItems(
      prevItems.map((n) =>
        n.id === id && n.readAt === null
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    );
    setUnread(Math.max(0, prevUnread - 1));
    startTransition(() => {
      markNotificationAsReadAction({ notificationId: id }).catch(() => {
        setItems(prevItems);
        setUnread(prevUnread);
      });
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
    const prevItems = items;
    const prevUnread = unread;
    const now = new Date().toISOString();
    setItems(prevItems.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)));
    setUnread(0);
    startTransition(() => {
      markAllNotificationsAsReadAction().catch(() => {
        setItems(prevItems);
        setUnread(prevUnread);
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
          {/* ⚠️ 알림 설정 (Settings2) 아이콘은 /account/notifications 설정 페이지가 생길 때 추가한다.
              설정 화면이 없는 상태에서 미리 노출하면 404 로 이어진다. */}
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
              badge={unread}
            />
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unread === 0}
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
            grouped.map(({ category, items: catItems }) => (
              <section key={category}>
                <h3 className="text-muted-foreground px-5 pt-4 pb-1.5 text-xs font-medium">
                  {category}
                </h3>
                <ul>
                  {catItems.map((n) => (
                    <NotificationItem
                      key={n.id}
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
            active
              ? "bg-brand text-white"
              : "bg-muted text-muted-foreground",
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
  const Icon = iconForNotificationKind(notification.kind);
  const isUnread = notification.readAt === null;

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
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "text-foreground truncate text-sm leading-snug",
                isUnread ? "font-semibold" : "font-medium",
              )}
            >
              {notification.message}
            </p>
            {isUnread && (
              <span
                aria-label="읽지 않음"
                className="bg-accent-teal size-1.5 shrink-0 rounded-full"
              />
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatRelativeTime(notification.createdAt)}
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
