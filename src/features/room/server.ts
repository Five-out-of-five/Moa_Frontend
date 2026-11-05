import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { getRoomSnapshot, rooms } from "@/mocks/db";
import type { Room } from "@/types/db";

/**
 * 방 도메인 서버 사이드 조회.
 *
 * isMock 분기는 **여기(server.ts)** 에서만 한다. 컴포넌트는 `listMyRooms` 를 부를 뿐
 * 그 뒤가 목인지 실서버인지 모른다.
 */

export async function listMyRooms(): Promise<Room[]> {
  if (isMock) return rooms;
  return api<Room[]>("/api/v1/rooms");
}

export async function getRoomDashboard(roomId: number) {
  if (isMock) return getRoomSnapshot(roomId);
  // 실서버: 아직 전용 스냅샷 API 가 없다면 각 위젯 API 를 병렬로 호출해 합친다.
  throw new Error("실서버 모드에서 room dashboard 집계는 아직 미구현.");
}
