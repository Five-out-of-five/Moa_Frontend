import "server-only";

import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers } from "@/mocks/db";

import { getFirstRoomProfile, getMockRoomMemberProfile } from "../first-profile/server";

export async function getRoomMemberProfile(roomId: string, accountId: string) {
  if (!isMock) return;
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || entry.setup.needsSetup) return;
  const member = roomMembers.find(
    (member) => member.roomId === entry.room.id && String(member.accountId) === accountId,
  );
  if (!member) return;

  const account = accounts.find(({ id }) => id === member.accountId);
  const isSelf = member.accountId === entry.setup.account.id;
  if (!account || !isActiveMember(member)) {
    return {
      isSelf,
      name: account ? "방을 나간 사용자입니다" : "탈퇴한 유저입니다",
      position: null,
      imageUrl: null,
    };
  }

  const profile = getMockRoomMemberProfile(member);
  return {
    isSelf,
    name: (profile ? profile.nickname : member.nickname) ?? account.name,
    position: profile?.position ?? null,
    imageUrl: profile?.imageUrl ?? null,
  };
}
