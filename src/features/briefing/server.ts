import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardEvents } from "@/mocks/db";
import type { BoardEvent } from "@/types/db";

/** 캐치업 브리핑 — 방 변경 이벤트 로그 최근 분. 30일 보관. */
export async function listBoardEvents(roomId: number): Promise<BoardEvent[]> {
  if (isMock) {
    return boardEvents
      .filter((e) => e.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return api<BoardEvent[]>(`/api/v1/rooms/${roomId}/briefing`);
}
