import "server-only";

import { getMyAccount } from "@/features/account/server";
import { api } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, getRoomSnapshot, roomMembers, rooms } from "@/mocks/db";
import type { MemberRef, Room } from "@/types/db";

export async function listMyRoomsForSettings() {
  const myRooms = await listMyRooms();
  const account = isMock ? await getMyAccount() : null;
  return myRooms.map((room) => {
    const member = isMock
      ? roomMembers.find((member) =>
          member.roomId === room.id && member.accountId === account?.id && isActiveMember(member),
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
    const account = await getMyAccount();
    const memberRoomIds = new Set(
      roomMembers
        .filter((member) => member.accountId === account.id && isActiveMember(member))
        .map((member) => member.roomId),
    );
    return rooms.filter((room) => memberRoomIds.has(room.id));
  }
  return api<Room[]>("/api/v1/rooms", { cache: "no-store" });
}

export async function getWorkspaceSelection() {
  const workspaces = await listMyRooms();
  const recentRoomId = isMock ? (await getMyAccount()).lastRoomId : null;
  const recentWorkspace = workspaces.find((room) => room.id === recentRoomId);

  return { workspaces, recentWorkspace };
}

export async function getRoomDashboard(roomId: number) {
  if (isMock) return getRoomSnapshot(roomId);
  // 실서버: 아직 전용 스냅샷 API 가 없다면 각 위젯 API 를 병렬로 호출해 합친다.
  throw new Error("실서버 모드에서 room dashboard 집계는 아직 미구현.");
}

/**
 * 방의 활성 멤버 목록 — 명세 `GET /api/v1/rooms/{roomId}/members` 를 `MemberRef` 로
 * 정규화해서 돌려준다. 업무 생성 Dialog 의 담당자 셀렉터 등 멤버 리스트가 필요한
 * 위젯이 공용으로 쓴다.
 *
 * ⚠️ `LEFT` / `KICKED` 는 제외. 비담당(= 담당자 없음) 옵션은 호출부가 UI 에서 추가.
 */
export async function listRoomMembers(roomId: number): Promise<MemberRef[]> {
  if (isMock) {
    return roomMembers
      .filter((m) => m.roomId === roomId && isActiveMember(m))
      .map((m) => {
        const acc = accounts.find((a) => a.id === m.accountId);
        return {
          accountId: m.accountId,
          displayName: m.nickname ?? acc?.name ?? `사용자 ${m.accountId}`,
          profileImageUrl: null,
          memberStatus: "ACTIVE" as const,
        } satisfies MemberRef;
      });
  }
  return api<MemberRef[]>(`/api/v1/rooms/${roomId}/members`);
}
