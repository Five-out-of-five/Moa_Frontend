import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { api } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, getRoomSnapshot, roomMembers, rooms } from "@/mocks/db";
import type { components } from "@/types/api";
import type { MemberRef, Room } from "@/types/db";

import { listActiveRoomMembers } from "./management/api-server";

type RoomSummary = Pick<Room, "id" | "name" | "description" | "imageUrl" | "memberCount"> & {
  myRole?: "OWNER" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE";
};

export async function listMyRoomsForSettings() {
  const myRooms = await listMyRooms();
  if (!isMock) {
    return myRooms.map((room) => ({
      ...room,
      isOwner: room.myRole ? isRoomOwner({ role: room.myRole }) : null,
      canLeave: room.myRole === "MEMBER" && room.status !== "INACTIVE",
    }));
  }
  const account = await getMyAccount();
  return myRooms.map((room) => {
    const member = roomMembers.find((member) =>
      member.roomId === room.id && member.accountId === account.id && isActiveMember(member),
    );
    return { ...room, isOwner: member ? isRoomOwner(member) : null, canLeave: member?.role === "MEMBER" };
  });
}

/**
 * 로그인 사용자가 참여 중인 워크스페이스를 조회한다.
 */
export const listMyRooms = cache(async (): Promise<RoomSummary[]> => {
  if (isMock) {
    const account = await getMyAccount();
    const memberRoomIds = new Set(
      roomMembers
        .filter((member) => member.accountId === account.id && isActiveMember(member))
        .map((member) => member.roomId),
    );
    return rooms.filter((room) => memberRoomIds.has(room.id));
  }
  const cookieName = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
  const accessToken = (await cookies()).get(cookieName)?.value;
  const summaries = await api<components["schemas"]["RoomSummaryResponse"][]>("/api/v1/rooms", { cache: "no-store", accessToken });
  return summaries.map((room) => {
    if (room.roomId == null || room.name == null) throw new Error("워크스페이스 목록 응답이 올바르지 않습니다.");
    return {
      id: room.roomId,
      name: room.name,
      description: null,
      imageUrl: room.imageUrl ?? null,
      memberCount: room.memberCount ?? 0,
      myRole: room.myRole,
      status: room.status,
    };
  });
});

export async function getWorkspaceSelection() {
  const workspaces = await listMyRooms();
  const recentRoomId = (await getMyAccount()).lastRoomId;
  const recentWorkspace = workspaces.find((room) => room.id === recentRoomId && room.status !== "INACTIVE");

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
export async function listRoomMembers(roomId: number): Promise<(MemberRef & { online?: boolean })[]> {
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
  const members = await listActiveRoomMembers(roomId);
  return members.flatMap((member) => member.accountId == null ? [] : [{
    accountId: member.accountId,
    displayName: member.displayName ?? "이름 없는 멤버",
    profileImageUrl: member.profileImageUrl ?? null,
    online: member.online,
    memberStatus: "ACTIVE" as const,
  }]);
}
