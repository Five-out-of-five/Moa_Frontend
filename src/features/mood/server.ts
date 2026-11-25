import "server-only";

import { listRoomMembers } from "@/features/room/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { moodStatuses } from "@/mocks/db";
import type { components } from "@/types/api";
import type { MoodLevel } from "@/types/db";

import { shiftMoodDate, todayMoodDate } from "./date";
import { type MoodCounts, type MoodPeriod, type MoodTrendPoint, summarizeMoods, type TeamMoodMember } from "./model";

const API_PERIOD = { 1: "TODAY", 7: "DAYS_7", 30: "DAYS_30" } as const;

type TeamMood = { members: TeamMoodMember[]; distribution: MoodCounts; trend: MoodTrendPoint[] };

// 개발 서버의 목 저장소는 핫 리로드 이후에도 이전 값을 보관할 수 있다.
function normalizeMockMood(mood: MoodLevel | "GREAT" | "SOSO" | "BAD"): MoodLevel {
  if (mood === "GREAT") return "VERY_GOOD";
  if (mood === "SOSO") return "NORMAL";
  if (mood === "BAD") return "EXHAUSTED";
  return mood;
}

export async function getTeamMood(roomId: number, period: MoodPeriod = 1, today = todayMoodDate()): Promise<TeamMood> {
  if (isMock) return getMockTeamMood(roomId, period, today);

  const data = await api<components["schemas"]["TeamMoodResponse"]>(
    `/api/v1/rooms/${roomId}/moods?period=${API_PERIOD[period]}`,
    { cache: "no-store" },
  );
  return {
    members: (data.members ?? []).flatMap((member) => member.accountId == null ? [] : [{
      id: member.accountId,
      name: member.displayName ?? "이름 없는 멤버",
      imageUrl: member.profileImageUrl ?? null,
      mood: member.mood ?? null,
      note: member.comment ?? null,
    }]),
    distribution: data.distribution ?? {},
    trend: period === 1 ? [] : (data.trend ?? []).flatMap(({ date, counts }) =>
      date ? [{ date, average: summarizeMoods(counts ?? {}).average }] : [],
    ),
  };
}

async function getMockTeamMood(roomId: number, period: MoodPeriod, today: string): Promise<TeamMood> {
  const roster = await listRoomMembers(roomId);
  const activeIds = new Set(roster.map(({ accountId }) => accountId));
  const start = shiftMoodDate(today, 1 - period);
  const groups = new Map<string, MoodCounts>();
  const current = new Map<number, { mood: MoodLevel; note: string | null }>();
  for (const row of moodStatuses) {
    if (row.roomId !== roomId || row.recordedDate < start || row.recordedDate > today) continue;
    const mood = normalizeMockMood(row.mood);
    if (row.recordedDate === today) {
      if (!activeIds.has(row.accountId)) continue;
      current.set(row.accountId, { mood, note: row.note });
    }
    const counts = groups.get(row.recordedDate) ?? {};
    counts[mood] = (counts[mood] ?? 0) + 1;
    groups.set(row.recordedDate, counts);
  }
  return {
    members: roster.map(({ accountId, displayName, profileImageUrl }) => ({
      id: accountId,
      name: displayName,
      imageUrl: profileImageUrl,
      mood: current.get(accountId)?.mood ?? null,
      note: current.get(accountId)?.note ?? null,
    })),
    distribution: groups.get(today) ?? {},
    trend: period === 1 ? [] : Array.from({ length: period }, (_, index) => {
      const date = shiftMoodDate(start, index);
      return { date, average: summarizeMoods(groups.get(date) ?? {}).average };
    }),
  };
}
