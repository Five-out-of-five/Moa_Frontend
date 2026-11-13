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
 * ⚠️ **"전체 최근 50 + 읽지 않음 첫 페이지 + 전역 미읽음 수"** 세 요청을 미리 가져온다.
 *    세 요청은 `Promise.allSettled` 로 서로 영향 없이 로드하고, 각 실패마다 **의미 있는
 *    fallback** 을 적용한다:
 *      - unread 요청 실패 → recent 안의 미읽음으로 임시 fallback (사용자에게 "읽지 않은
 *        알림 없음" 오인 방지)
 *      - count 요청 실패 → unread 응답의 `totalElements` 를 우선 사용 (로컬 length 는
 *        size 50 로 잘려 있을 수 있음)
 *      - unreadHasNext → 드로워의 "더 불러오기" 버튼 노출 여부 결정 (51+ 미읽음도 접근 가능)
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
  const unreadPage =
    unreadResult.status === "fulfilled" ? unreadResult.value : null;
  // unread 요청 실패 시 recent 안 미읽음으로 fallback — "읽지 않은 알림 없음" 오인 방지.
  const unread = unreadPage?.content ?? recent.filter((n) => !n.read);
  const unreadHasNext = unreadPage?.hasNext ?? false;
  // count fallback: 서버 count 실패 → unread 응답 totalElements (서버가 아는 전체 수)
  //                 → 마지막 수단으로 로컬 unread.length (size 50 로 잘림 유의)
  const unreadCount =
    unreadCountResult.status === "fulfilled"
      ? unreadCountResult.value
      : (unreadPage?.totalElements ?? unread.length);

  return (
    <NotificationDropdown
      initialRecent={recent}
      initialUnread={unread}
      initialUnreadCount={unreadCount}
      initialUnreadHasNext={unreadHasNext}
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
