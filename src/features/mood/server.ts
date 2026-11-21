import "server-only";

import { api } from "@/lib/api";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { moodStatuses, roomMembers } from "@/mocks/db";
import type { MoodStatus } from "@/types/db";

import { shiftMoodDate, todayMoodDate } from "./date";
import { type MoodPeriod, summarizeMoods } from "./model";

/** 방의 오늘 상태값 목록 — MOOD 위젯이 부른다. */
export async function listTodayMoods(roomId: number): Promise<MoodStatus[]> {
  if (isMock) {
    const today = todayMoodDate();
    return moodStatuses.filter(
      (m) => m.roomId === roomId && m.recordedDate === today,
    );
  }
  return api<MoodStatus[]>(`/api/v1/rooms/${roomId}/moods?date=today`);
}

export async function listMoodTrend(roomId: number, period: Exclude<MoodPeriod, 1>, today: string) {
  if (!isMock) return null;
  const start = shiftMoodDate(today, 1 - period);
  const activeIds = new Set(roomMembers.filter((member) => member.roomId === roomId && isActiveMember(member)).map(({ accountId }) => accountId));
  const groups = new Map<string, MoodStatus[]>();
  for (const mood of moodStatuses) {
    if (mood.roomId !== roomId || mood.recordedDate < start || mood.recordedDate > today) continue;
    if (mood.recordedDate === today && !activeIds.has(mood.accountId)) continue;
    const group = groups.get(mood.recordedDate) ?? [];
    group.push(mood);
    groups.set(mood.recordedDate, group);
  }
  return Array.from({ length: period }, (_, index) => {
    const date = shiftMoodDate(start, index);
    return { date, average: summarizeMoods(groups.get(date) ?? []).average };
  });
}
