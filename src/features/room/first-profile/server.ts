import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { listMyRooms } from "@/features/room/server";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { roomMembers, rooms } from "@/mocks/db";

import type { FirstRoomProfile } from "./types";

const runtime = globalThis as typeof globalThis & {
  moaFirstRoomProfiles?: Map<string, FirstRoomProfile>;
};
const profiles = (runtime.moaFirstRoomProfiles ??= new Map());

function membershipKey(member: (typeof roomMembers)[number]) {
  return `${member.roomId}:${member.accountId}:${member.id}`;
}

export const getFirstRoomProfile = cache(async (roomId: string) => {
  const room = (await listMyRooms()).find(({ id }) => String(id) === roomId);
  if (!room) return null;
  if (!isMock) return { room, setup: null };

  const account = await getMyAccount();
  const member = roomMembers.find(
    (member) =>
      member.roomId === room.id && member.accountId === account.id && isActiveMember(member),
  );
  if (!member) return null;

  const key = membershipKey(member);
  const profile = profiles.get(key);
  // 두 번째 워크스페이스는 승인 직후 상태를 재현하는 목 시드다.
  const needsSetup = room.id === rooms[1]?.id && !profile;
  return { room, setup: { account, member, key, profile, needsSetup } };
});

export function isNicknameTaken(roomId: number, accountId: number, nickname: string) {
  return roomMembers.some(
    (member) =>
      member.roomId === roomId &&
      member.accountId !== accountId &&
      isActiveMember(member) &&
      (profiles.get(membershipKey(member))?.nickname ?? member.nickname) === nickname,
  );
}

export function completeMockFirstRoomProfile(key: string, profile: FirstRoomProfile) {
  if (!profiles.has(key)) profiles.set(key, profile);
}

export function updateMockRoomProfile(key: string, profile: FirstRoomProfile) {
  profiles.set(key, profile);
}
