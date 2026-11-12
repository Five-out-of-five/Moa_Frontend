import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  getUnreadNotificationCount,
  listMyNotifications,
} from "../server";
import { NotificationDropdown } from "./NotificationDropdown";

/**
 * 알림 데이터를 **헤더와 분리된 경계**에서 로드한다 — Header 가 이 결과를 기다리면
 * 알림 요청이 느리거나 실패할 때 쉘 전체가 함께 멈춘다. Suspense 로 감싸서
 * 종 아이콘 자리에 fallback 을 띄우고, 실패하면 빈 드롭다운으로 떨어뜨린다
 * (헤더의 나머지는 계속 쓸 수 있다).
 *
 * ⚠️ **"전체 최근 50 + 읽지 않음 전체"** 두 벌을 미리 가져온다. "읽지 않음" 탭이 전체
 *    최근 50 안에서만 필터한다면 size 를 초과한 미읽음 알림이 숨어 버리기 때문이다.
 *    세 요청은 `Promise.allSettled` 로 서로 영향 없이 로드한다 — 하나가 실패해도 다른
 *    쪽은 그대로 쓴다.
 */
export async function NotificationBellLoader() {
  const [recentResult, unreadResult, unreadCountResult] = await Promise.allSettled([
    listMyNotifications({ size: 50 }),
    listMyNotifications({ unreadOnly: true, size: 50 }),
    getUnreadNotificationCount(),
  ]);

  if (recentResult.status === "rejected") {
    console.error("NotificationBellLoader recent failed:", recentResult.reason);
  }
  if (unreadResult.status === "rejected") {
    console.error("NotificationBellLoader unread failed:", unreadResult.reason);
  }
  if (unreadCountResult.status === "rejected") {
    console.error(
      "NotificationBellLoader unread-count failed:",
      unreadCountResult.reason,
    );
  }

  const recent =
    recentResult.status === "fulfilled" ? recentResult.value.content : [];
  const unread =
    unreadResult.status === "fulfilled" ? unreadResult.value.content : [];
  const unreadCount =
    unreadCountResult.status === "fulfilled"
      ? unreadCountResult.value
      : unread.length;

  return (
    <NotificationDropdown
      initialRecent={recent}
      initialUnread={unread}
      initialUnreadCount={unreadCount}
    />
  );
}

export function NotificationBellFallback() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="알림 불러오는 중"
      disabled
      className="opacity-70"
    >
      <Bell className="size-5" />
    </Button>
  );
}
