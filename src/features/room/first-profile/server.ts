import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { listMyRooms } from "@/features/room/server";
import { api, ApiError } from "@/lib/api";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers } from "@/mocks/db";
import type { components } from "@/types/api";

import { roomManagementMock } from "../management/mock-state";
import type { FirstRoomProfile } from "./types";

const runtime = globalThis as typeof globalThis & {
  moaFirstRoomProfiles?: Map<string, FirstRoomProfile>;
};
const profiles = (runtime.moaFirstRoomProfiles ??= new Map());

function membershipKey(member: (typeof roomMembers)[number]) {
  return `${member.roomId}:${member.accountId}:${member.id}`;
}

export function getMockRoomMemberProfile(member: (typeof roomMembers)[number]) {
  return profiles.get(membershipKey(member));
}

export function getMockRoomMemberNickname(member: (typeof roomMembers)[number]) {
  const profile = getMockRoomMemberProfile(member);
  return (profile ? profile.nickname : member.nickname) ??
    accounts.find(({ id }) => id === member.accountId)?.name;
}

export const getFirstRoomProfile = cache(async (roomId: string) => {
  if (!/^[1-9]\d*$/.test(roomId) || !Number.isSafeInteger(Number(roomId))) return null;
  if (!isMock) {
    try {
      const detail = await api<components["schemas"]["RoomDetailResponse"]>(
        `/api/v1/rooms/${roomId}`, { cache: "no-store" },
      );
      if (detail.roomId !== Number(roomId) || !detail.name || !detail.myMembership) return null;
      const membership = detail.myMembership;
      return {
        room: { id: detail.roomId, name: detail.name, description: detail.description ?? null },
        setup: {
          account: await getMyAccount(),
          member: { roomId: detail.roomId, nickname: membership.nickname ?? null },
          profile: {
            nickname: membership.nickname ?? null,
            position: membership.positionLabel ?? null,
            imageUrl: membership.profileImageUrl ?? null,
          },
          needsSetup: detail.needsProfileSetup === true,
          mockKey: null,
        },
      };
    } catch (error) {
      if (error instanceof ApiError && (error.code === "ROOM_NOT_FOUND" || error.code === "ROOM_NOT_MEMBER")) return null;
      throw error;
    }
  }
  const room = (await listMyRooms()).find(({ id }) => String(id) === roomId);
  if (!room) return null;

  const account = await getMyAccount();
  const member = roomMembers.find(
    (member) =>
      member.roomId === room.id && member.accountId === account.id && isActiveMember(member),
  );
  if (!member) return null;

  const key = membershipKey(member);
  const profile = profiles.get(key);
  // 두 번째 워크스페이스는 승인 직후 상태를 재현하는 목 시드다.
  const needsSetup = (room.id === 2 || roomManagementMock.newMemberships.has(member.id)) && !profile;
  return { room, setup: { account, member, mockKey: key, profile, needsSetup } };
});

export function isNicknameTaken(roomId: number, accountId: number, nickname: string) {
  return roomMembers.some(
    (member) =>
      member.roomId === roomId &&
      member.accountId !== accountId &&
      isActiveMember(member) &&
      getMockRoomMemberNickname(member) === nickname,
  );
}

export function completeMockFirstRoomProfile(key: string, profile: FirstRoomProfile) {
  if (!profiles.has(key)) profiles.set(key, profile);
}

export function updateMockRoomProfile(key: string, profile: FirstRoomProfile) {
  profiles.set(key, profile);
}
