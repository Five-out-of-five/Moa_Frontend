"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { moodStatuses } from "@/mocks/db";

import { todayMoodDate } from "./date";
import { getTeamMood } from "./server";

const submitMoodSchema = z.object({
  roomId: z.number().int().positive(),
  mood: z.enum(["VERY_GOOD", "GOOD", "NORMAL", "TIRED", "EXHAUSTED"]),
  comment: z.string().max(50).nullable().optional(),
});

export async function submitMoodAction(input: unknown): Promise<{ saved?: boolean; error?: string }> {
  const parsed = submitMoodSchema.safeParse(input);
  if (!parsed.success) return { error: "기분을 선택하고 코멘트를 50자 이내로 입력해 주세요." };
  try {
    return await saveMood(parsed.data);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : "기분을 저장하지 못했어요. 다시 시도해 주세요." };
  }
}

async function saveMood({ roomId, mood, comment }: z.infer<typeof submitMoodSchema>) {

  if (isMock) {
    const membership = await getManagedRoom(roomId);
    if (!membership) return { error: "이 방의 상태값을 변경할 수 없습니다." };
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
      if (comment !== undefined) existing.note = comment;
    } else {
      moodStatuses.push({
        id: Math.max(0, ...moodStatuses.map((m) => m.id)) + 1,
        roomId,
        accountId,
        mood,
        note: comment ?? null,
        recordedDate: today,
      });
    }
  } else {
    let savedComment = comment;
    if (comment === undefined) {
      const [me, team] = await Promise.all([getMyAccount(), getTeamMood(roomId)]);
      const member = team.members.find(({ id }) => id === me.id);
      if (!member) return { error: "이 방에서 내 기분을 확인할 수 없어요." };
      savedComment = member.note;
    }
    await api(`/api/v1/rooms/${roomId}/moods/me`, {
      method: "PUT",
      json: { mood, comment: savedComment },
      cache: "no-store",
    });
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/moods`);
  return { saved: true };
}

export async function saveMoodFormAction(
  roomId: number,
  _previous: { saved?: boolean; error?: string },
  form: FormData,
): Promise<{ saved?: boolean; error?: string }> {
  const note = form.get("note");
  return submitMoodAction({
    roomId, mood: form.get("mood"), comment: typeof note === "string" ? note.trim() || null : note,
  });
}
