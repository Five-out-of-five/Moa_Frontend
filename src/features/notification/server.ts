import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { notificationPreferences, notifications } from "@/mocks/db";
import type { components } from "@/types/api";
import type { Notification, NotificationGroup, PageResponse } from "@/types/db";

import { getMyAccount } from "../account/server";
import type { NotificationPreferences } from "./lib/preferences";

type NotificationSettingResponse = components["schemas"]["NotificationSettingResponse"];

/**
 * BE `NotificationSettingResponse` → FE `NotificationPreferences` 매핑.
 *
 * ⚠️ BE 응답은 `{ groups: [{ group, enabled, locked }] }` 배열, FE 소비 타입은 group→boolean 레코드.
 *    BE 가 돌려주지 않은 그룹은 기본 활성화(true)로 두어 UI 토글 초기값 꼬임을 막는다.
 *    `locked` 는 FE 가 아직 UI 로 사용하지 않지만, SYSTEM 그룹은 BE 쪽에서 항상 locked 로 내려온다.
 */
function toPreferences(res: NotificationSettingResponse): NotificationPreferences {
  const base: NotificationPreferences = {
    MY_ACTIVITY: true,
    TASK: true,
    VOTE: true,
    SESSION: true,
    MEMBER_ROLE: true,
    SYSTEM: true,
  };
  for (const g of res.groups ?? []) {
    if (g.group) base[g.group as NotificationGroup] = g.enabled ?? true;
  }
  return base;
}

export async function getGlobalNotificationPreferences(): Promise<NotificationPreferences | null> {
  if (isMock) {
    const { id } = await getMyAccount();
    const preferences = notificationPreferences.get(id);
    return {
      MY_ACTIVITY: true,
      TASK: true,
      VOTE: true,
      SESSION: true,
      MEMBER_ROLE: true,
      ...preferences,
      SYSTEM: true,
    };
  }
  const res = await api<NotificationSettingResponse>("/api/v1/notification-settings");
  return toPreferences(res);
}

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
    const effectiveSize = Math.max(1, size);
    const totalElements = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / effectiveSize));
    const start = page * effectiveSize;
    const content = sorted.slice(start, start + effectiveSize);
    return {
      content,
      page,
      size: effectiveSize,
      totalElements,
      totalPages,
      hasNext: page + 1 < totalPages,
    };
  }

  // ⚠️ size 는 항상 전달한다. BE 기본값(20) 과 FE 기본값(50) 이 달라 생략하면
  //    헤더 드로워의 첫 페이지 노출 분량이 쪼그라든다.
  const query = new URLSearchParams();
  if (unreadOnly) query.set("unreadOnly", "true");
  if (page > 0) query.set("page", String(page));
  query.set("size", String(size));
  return api<PageResponse<Notification>>(
    `/api/v1/notifications?${query.toString()}`,
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
