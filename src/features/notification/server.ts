import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { notifications } from "@/mocks/db";
import type { Notification, PageResponse } from "@/types/db";

/**
 * 알림 목록 — 명세 `GET /api/v1/notifications`, `PageResponse<NotificationResponse>`.
 *
 * ⚠️ 호출부(헤더 드로워) 는 최근 N개만 표시하지만, 서버는 "최근 몇 개를 쓰는지" 모른다.
 *    목에서는 unreadOnly 만 분기하고 페이지는 통째로 돌려준다.
 * ⚠️ 목 모드에선 홍근 계정(id=1) 의 알림만 저장소에 깔려 있다. BE 가 붙으면 세션에서
 *    accountId 를 뽑는다.
 */
export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

export async function listMyNotifications(
  opts: ListNotificationsOptions = {},
): Promise<PageResponse<Notification>> {
  const { unreadOnly = false, page = 0, size = 50 } = opts;

  if (isMock) {
    const base = unreadOnly
      ? notifications.filter((n) => !n.read)
      : notifications;
    const sorted = [...base].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return {
      content: sorted,
      page: 0,
      size: sorted.length,
      totalElements: sorted.length,
      totalPages: 1,
      hasNext: false,
    };
  }

  const query = new URLSearchParams();
  if (unreadOnly) query.set("unreadOnly", "true");
  if (page > 0) query.set("page", String(page));
  if (size !== 50) query.set("size", String(size));
  const qs = query.toString();
  return api<PageResponse<Notification>>(
    `/api/v1/notifications${qs ? `?${qs}` : ""}`,
  );
}

/** 미읽음 알림 개수 — 헤더 배지에 표시. 99 초과는 FE 가 "99+" 로 축약. */
export async function getUnreadNotificationCount(): Promise<number> {
  if (isMock) {
    return notifications.filter((n) => !n.read).length;
  }
  const res = await api<{ count: number }>(
    "/api/v1/notifications/unread-count",
  );
  return res.count;
}
