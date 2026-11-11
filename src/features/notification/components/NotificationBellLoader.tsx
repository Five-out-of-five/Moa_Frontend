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
 */
export async function NotificationBellLoader() {
  try {
    const [notifications, unreadCount] = await Promise.all([
      listMyNotifications(),
      getUnreadNotificationCount(),
    ]);
    return (
      <NotificationDropdown
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
    );
  } catch {
    return (
      <NotificationDropdown
        initialNotifications={[]}
        initialUnreadCount={0}
      />
    );
  }
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
