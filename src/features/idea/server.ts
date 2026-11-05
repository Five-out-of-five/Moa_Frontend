import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";
import type { BoardSession, IdeaCard } from "@/types/db";

/** 방의 진행 중 회차. 없으면 null (이 경우 카드 등록 불가 - 명세 §board_session) */
export async function getActiveSession(
  roomId: number,
): Promise<BoardSession | null> {
  if (isMock) {
    return boardSessions.find((s) => s.roomId === roomId && s.state === "ACTIVE") ?? null;
  }
  return api<BoardSession | null>(`/api/v1/rooms/${roomId}/idea-sessions/active`);
}

/** 진행 중 회차의 카드 목록 — AGENDA/KEEP/PROBLEM/TRY 별로 분리해 소비한다. */
export async function listIdeaCards(roomId: number): Promise<IdeaCard[]> {
  if (isMock) return ideaCards.filter((c) => c.roomId === roomId);
  return api<IdeaCard[]>(`/api/v1/rooms/${roomId}/idea-cards`);
}
