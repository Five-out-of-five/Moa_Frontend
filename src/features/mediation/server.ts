import "server-only";

import { getIdeaRevision } from "@/features/idea/mock-board";
import { getManagedRoom } from "@/features/room/management/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { compromiseDrafts, conflicts, ideaCards, roomWidgets } from "@/mocks/db";
import type { CardConflict } from "@/types/db";

/** AI 가 감지한 카드 충돌 목록 — MEDIATION 위젯에서 부른다. */
export async function listConflicts(roomId: number): Promise<CardConflict[]> {
  if (isMock) {
    if (!roomWidgets.some((item) => item.roomId === roomId && item.widgetType === "MEDIATION")) return [];
    return conflicts.filter((c) => c.roomId === roomId &&
      ideaCards.some((card) => card.roomId === roomId && card.id === c.leftCardId) &&
      ideaCards.some((card) => card.roomId === roomId && card.id === c.rightCardId));
  }
  return api<CardConflict[]>(`/api/v1/rooms/${roomId}/conflicts`);
}

export async function getMediationBoard(roomId: number) {
  if (!isMock) return null;
  const context = await getManagedRoom(roomId);
  if (!context) return null;
  const revision = getIdeaRevision(roomId);
  const enabled = roomWidgets.some((item) => item.roomId === roomId && item.widgetType === "MEDIATION");
  const items = await listConflicts(roomId);
  const ids = new Set(items.map(({ id }) => id));
  return {
    enabled, items, revision,
    cards: ideaCards.filter((card) => card.roomId === roomId && items.some((item) => item.leftCardId === card.id || item.rightCardId === card.id)),
    drafts: compromiseDrafts.filter((draft) => ids.has(draft.conflictId) && draft.requestedBy.accountId === context.account.id),
  };
}
