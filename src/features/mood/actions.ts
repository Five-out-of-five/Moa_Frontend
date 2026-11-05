"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { moodStatuses } from "@/mocks/db";
import type { MoodLevel } from "@/types/db";

const submitMoodSchema = z.object({
  roomId: z.number().int().positive(),
  accountId: z.number().int().positive(), // 실서버에서는 세션에서 뽑는다
  mood: z.enum(["GREAT", "GOOD", "SOSO", "TIRED", "BAD"]),
  note: z.string().max(200).nullable(),
});

/**
 * 오늘의 상태값 작성·수정 (하루 1건, upsert).
 *
 * ⚠️ 실서버 호출은 세션의 accountId 를 쓴다 — 지금은 목이라 요청에 담아 받는다.
 *    BE 가 붙으면 `accountId` 를 요청에서 뺀다.
 */
export async function submitMoodAction(input: unknown) {
  const { roomId, accountId, mood, note } = submitMoodSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);

  if (isMock) {
    const existing = moodStatuses.find(
      (m) =>
        m.roomId === roomId &&
        m.accountId === accountId &&
        m.recordedDate === today,
    );
    if (existing) {
      existing.mood = mood as MoodLevel;
      existing.note = note;
    } else {
      moodStatuses.push({
        id: Math.max(0, ...moodStatuses.map((m) => m.id)) + 1,
        roomId,
        accountId,
        mood: mood as MoodLevel,
        note,
        recordedDate: today,
      });
    }
  } else {
    await api<void>(`/api/v1/rooms/${roomId}/moods`, {
      method: "POST",
      json: { mood, note },
    });
  }

  revalidatePath(`/rooms/${roomId}`);
}
