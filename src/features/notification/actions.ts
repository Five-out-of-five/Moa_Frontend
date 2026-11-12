"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { deleteNotificationFromMock, notifications } from "@/mocks/db";

const notificationIdSchema = z.object({
  notificationId: z.number().int().positive(),
});

/**
 * 알림 하나를 읽음 처리.
 *
 * ⚠️ 명세의 `read` 는 boolean 이다. 같은 알림을 다시 눌러도 결과가 같도록 **멱등**으로
 *    처리한다 — 이미 읽음이면 아무 일도 안 하고 성공 반환.
 */
export async function markNotificationAsReadAction(input: unknown) {
  const { notificationId } = notificationIdSchema.parse(input);

  if (isMock) {
    const found = notifications.find((n) => n.notificationId === notificationId);
    if (found && !found.read) found.read = true;
  } else {
    await api<void>(`/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  }

  revalidatePath("/", "layout");
}

/** 내 모든 알림을 한 번에 읽음 처리 */
export async function markAllNotificationsAsReadAction() {
  if (isMock) {
    for (const n of notifications) {
      if (!n.read) n.read = true;
    }
  } else {
    await api<void>("/api/v1/notifications/read-all", { method: "PATCH" });
  }

  revalidatePath("/", "layout");
}

/**
 * 알림 한 건 삭제 — 명세 `DELETE /api/v1/notifications/{notificationId}`.
 *
 * ⚠️ 복구 UI 는 없다. 호출 전 사용자 확인 책임은 호출부에 있다.
 */
export async function deleteNotificationAction(input: unknown) {
  const { notificationId } = notificationIdSchema.parse(input);

  if (isMock) {
    deleteNotificationFromMock(notificationId);
  } else {
    await api<void>(`/api/v1/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  revalidatePath("/", "layout");
}
