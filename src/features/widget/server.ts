import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";
import type { RoomWidget } from "@/types/db";

/** 방 대시보드의 위젯 배치 조회. 대시보드 진입 시 가장 먼저 부른다. */
export async function listRoomWidgets(roomId: number): Promise<RoomWidget[]> {
  if (isMock) return roomWidgets.filter((w) => w.roomId === roomId);
  return api<RoomWidget[]>(`/api/v1/rooms/${roomId}/dashboard/widgets`);
}
