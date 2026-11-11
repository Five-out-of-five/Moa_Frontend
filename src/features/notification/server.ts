import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { notifications } from "@/mocks/db";
import type { Notification } from "@/types/db";

/**
 * 알림 목록 — 헤더 드롭다운이 부른다.
 *
 * ⚠️ 명세상 알림은 90일 보관 후 삭제. 드롭다운은 최근 N개만 보여 주지만, 여기서는
 *    목록 전체를 돌려주고 호출부가 slice 한다 — "최근 몇 개를 쓰나" 가 바뀌어도 서버는
 *    모른다.
 * ⚠️ 목 모드에서는 홍근 계정(id=1) 의 알림만 돌아간다. BE 가 붙으면 세션에서 accountId
 *    를 뽑는다.
 */
export async function listMyNotifications(): Promise<Notification[]> {
  if (isMock) {
    const me = 1;
    return notifications
      .filter((n) => n.accountId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return api<Notification[]>("/api/v1/notifications");
}

/** 미읽음 알림 개수 — 헤더 배지에 표시 */
export async function getUnreadNotificationCount(): Promise<number> {
  if (isMock) {
    const me = 1;
    return notifications.filter((n) => n.accountId === me && n.readAt === null)
      .length;
  }
  const res = await api<{ count: number }>(
    "/api/v1/notifications/unread-count",
  );
  return res.count;
}
