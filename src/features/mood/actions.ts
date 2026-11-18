"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import { getManagedRoom } from "@/features/room/management/server";
import { listMyRooms } from "@/features/room/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { moodStatuses } from "@/mocks/db";

import { todayMoodDate } from "./date";
import { listTodayMoods } from "./server";

const submitMoodSchema = z.object({
  roomId: z.number().int().positive(),
  mood: z.enum(["GREAT", "GOOD", "SOSO", "TIRED", "BAD"]),
  note: z.string().max(50).nullable().optional(),
});

export async function submitMoodAction(input: unknown) {
  const { roomId, mood, note } = submitMoodSchema.parse(input);

  if (isMock) {
    const membership = await getManagedRoom(roomId);
    if (!membership) throw new Error("이 방의 상태값을 변경할 수 없습니다.");
    const accountId = membership.account.id;
    const today = todayMoodDate();
    const existing = moodStatuses.find(
      (m) =>
        m.roomId === roomId &&
        m.accountId === accountId &&
        m.recordedDate === today,
    );
    if (existing) {
      existing.mood = mood;
      if (note !== undefined) existing.note = note;
    } else {
      moodStatuses.push({
        id: Math.max(0, ...moodStatuses.map((m) => m.id)) + 1,
        roomId,
        accountId,
        mood,
        note: note ?? null,
        recordedDate: today,
      });
    }
  } else {
    if (!(await listMyRooms()).some(({ id }) => id === roomId)) {
      throw new Error("이 방의 상태값을 변경할 수 없습니다.");
    }
    let savedNote = note;
    if (note === undefined) {
      const [me, moods] = await Promise.all([getMyAccount(), listTodayMoods(roomId)]);
      savedNote = moods.find(({ accountId }) => accountId === me.id)?.note ?? null;
    }
    await api<void>(`/api/v1/rooms/${roomId}/moods`, {
      method: "POST",
      json: { mood, note: savedNote },
    });
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/moods`);
}

export async function saveMoodFormAction(
  roomId: number,
  _previous: { saved?: boolean; error?: string },
  form: FormData,
): Promise<{ saved?: boolean; error?: string }> {
  const parsed = submitMoodSchema.safeParse({
    roomId, mood: form.get("mood"), note: String(form.get("note") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: "기분을 선택하고 코멘트를 50자 이내로 입력해 주세요." };
  try {
    await submitMoodAction(parsed.data);
    return { saved: true };
  } catch {
    return { error: "기분을 저장하지 못했어요. 다시 시도해 주세요." };
  }
}
