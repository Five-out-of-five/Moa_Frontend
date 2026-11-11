"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { notifications } from "@/mocks/db";

const markAsReadSchema = z.object({
  notificationId: z.number().int().positive(),
});

/**
 * 알림 하나를 읽음 처리.
 *
 * ⚠️ 알림은 "읽었다" 시점만 기록한다 (readAt). 되돌릴 일이 없는 1회성 동작이라 PATCH 로
 *    두되, 같은 알림을 다시 눌러도 결과가 같도록 **멱등**으로 처리한다 — 이미 읽음이면
 *    아무 일도 안 하고 성공 반환.
 */
export async function markNotificationAsReadAction(input: unknown) {
  const { notificationId } = markAsReadSchema.parse(input);

  if (isMock) {
    const found = notifications.find((n) => n.id === notificationId);
    if (found && found.readAt === null) {
      found.readAt = new Date().toISOString();
    }
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
    const me = 1;
    const now = new Date().toISOString();
    for (const n of notifications) {
      if (n.accountId === me && n.readAt === null) n.readAt = now;
    }
  } else {
    await api<void>("/api/v1/notifications/read-all", { method: "PATCH" });
  }

  revalidatePath("/", "layout");
}
