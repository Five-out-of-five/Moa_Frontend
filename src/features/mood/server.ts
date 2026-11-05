import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { moodStatuses } from "@/mocks/db";
import type { MoodStatus } from "@/types/db";

/** 방의 오늘 상태값 목록 — MOOD 위젯이 부른다. */
export async function listTodayMoods(roomId: number): Promise<MoodStatus[]> {
  if (isMock) {
    const today = new Date().toISOString().slice(0, 10);
    return moodStatuses.filter(
      (m) => m.roomId === roomId && m.recordedDate === today,
    );
  }
  return api<MoodStatus[]>(`/api/v1/rooms/${roomId}/moods?date=today`);
}
