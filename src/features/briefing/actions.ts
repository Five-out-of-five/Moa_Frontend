"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";

import { type BriefingEventType, isBriefingEventType } from "./model";
import { confirmMockBriefing } from "./server";

export async function confirmBriefingAction(roomId: number, eventType?: BriefingEventType) {
  const fallback = "확인 상태를 저장하지 못했어요. 다시 시도해 주세요.";
  if (!Number.isSafeInteger(roomId) || roomId < 1 || (eventType !== undefined && !isBriefingEventType(eventType))) {
    return { ok: false as const, error: fallback };
  }
  try {
    if (isMock) {
      if (!(await confirmMockBriefing(roomId, eventType))) return { ok: false as const, error: fallback };
    } else {
      const path = `/api/v1/rooms/${roomId}/briefing`;
      if (eventType) await api(`${path}/dismiss`, { method: "POST", json: { eventType } });
      else await api(`${path}/check`, { method: "POST" });
    }
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, error: error instanceof ApiError ? error.message : fallback };
  }
  revalidatePath(`/rooms/${roomId}/briefing`);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true as const };
}
