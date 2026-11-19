"use server";

import { revalidatePath } from "next/cache";

import { confirmMockBriefing } from "./server";

export async function confirmBriefingAction(roomId: number, keys?: string[]) {
  if (!Number.isSafeInteger(roomId) || roomId < 1 ||
    (keys !== undefined && (!Array.isArray(keys) || keys.length < 1 || keys.length > 20 ||
      keys.some((key) => typeof key !== "string" || key.length > 150)))) return { ok: false as const };
  const result = await confirmMockBriefing(roomId, keys);
  if (!result) return { ok: false as const };
  revalidatePath(`/rooms/${roomId}/briefing`);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true as const, href: result.href };
}
