import "server-only";

import { api } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, getRoomSnapshot, roomMembers, rooms } from "@/mocks/db";
import type { Room } from "@/types/db";

export async function listMyRoomsForSettings() {
  const myRooms = await listMyRooms();
  return myRooms.map((room) => {
    const member = isMock
      ? roomMembers.find((member) =>
          member.roomId === room.id && member.accountId === accounts[0].id && isActiveMember(member),
        )
      : undefined;
    return { ...room, isOwner: member ? isRoomOwner(member) : null };
  });
}

/**
 * 방 도메인 서버 사이드 조회.
 *
 * isMock 분기는 **여기(server.ts)** 에서만 한다. 컴포넌트는 `listMyRooms` 를 부를 뿐
 * 그 뒤가 목인지 실서버인지 모른다.
 */

export async function listMyRooms(): Promise<Room[]> {
  if (isMock) {
    const memberRoomIds = new Set(
      roomMembers
        .filter((member) => member.accountId === accounts[0].id && isActiveMember(member))
        .map((member) => member.roomId),
    );
    return rooms.filter((room) => memberRoomIds.has(room.id));
  }
  return api<Room[]>("/api/v1/rooms", { cache: "no-store" });
}

export async function getWorkspaceSelection() {
  const workspaces = await listMyRooms();
  const recentRoomId = isMock ? accounts[0].lastRoomId : null;
  const recentWorkspace = workspaces.find((room) => room.id === recentRoomId);

  return { workspaces, recentWorkspace };
}

export async function getRoomDashboard(roomId: number) {
  if (isMock) return getRoomSnapshot(roomId);
  // 실서버: 아직 전용 스냅샷 API 가 없다면 각 위젯 API 를 병렬로 호출해 합친다.
  throw new Error("실서버 모드에서 room dashboard 집계는 아직 미구현.");
}
