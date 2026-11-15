import "server-only";

import { getMockMemberPresence } from "@/features/chat/server";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers } from "@/mocks/db";

import { getFirstRoomProfile, getMockRoomMemberProfile } from "../first-profile/server";

export async function listRoomMemberProfiles(roomId: string) {
  if (!isMock) return [];
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || entry.setup.needsSetup) return [];
  const members = roomMembers.filter((member) => member.roomId === entry.room.id);

  return members.map((member) => {
    const account = accounts.find(({ id }) => id === member.accountId);
    const status = !account ? "WITHDRAWN" : member.state;
    const identity = {
      accountId: member.accountId,
      membershipId: member.id,
      isSelf: member.accountId === entry.setup?.account.id,
    };
    if (!account || !isActiveMember(member)) {
      return {
        ...identity,
        status,
        name: status === "WITHDRAWN" ? "탈퇴한 유저입니다" : "방을 나간 사용자입니다",
        position: null,
        imageUrl: null,
        online: null,
      };
    }
    const profile = getMockRoomMemberProfile(member);
    return {
      ...identity,
      status,
      name: (profile ? profile.nickname : member.nickname) ?? account.name,
      position: profile?.position ?? null,
      imageUrl: profile?.imageUrl ?? null,
      online: identity.isSelf || getMockMemberPresence(account.id),
    };
  });
}

export async function getRoomMemberProfile(roomId: string, accountId: string) {
  return (await listRoomMemberProfiles(roomId)).find(
    (member) => String(member.accountId) === accountId,
  );
}
