import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { conflicts } from "@/mocks/db";
import type { CardConflict } from "@/types/db";

/** AI 가 감지한 카드 충돌 목록 — MEDIATION 위젯에서 부른다. */
export async function listConflicts(roomId: number): Promise<CardConflict[]> {
  if (isMock) return conflicts.filter((c) => c.roomId === roomId);
  return api<CardConflict[]>(`/api/v1/rooms/${roomId}/conflicts`);
}
