import "server-only";

import { getMockPresence } from "@/features/chat/server";
import { api, ApiError } from "@/lib/api";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers } from "@/mocks/db";
import type { components } from "@/types/api";

import {
  getFirstRoomProfile,
  getMockRoomMemberNickname,
  getMockRoomMemberProfile,
} from "../first-profile/server";
import { isRoomId } from "../management/api-server";

export async function getRoomMemberProfile(roomId: string, accountId: string) {
  if (!/^[1-9]\d*$/.test(accountId) || !isRoomId(Number(accountId))) return;
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || entry.setup.needsSetup) return;
  if (!isMock) {
    try {
      const profile = await api<components["schemas"]["MemberProfileResponse"]>(
        `/api/v1/rooms/${entry.room.id}/members/${accountId}`, { cache: "no-store" },
      );
      const isSelf = entry.setup.account.id === Number(accountId);
      const fallback = profile.memberStatus === "LEFT" ? "나간 멤버"
        : profile.memberStatus === "WITHDRAWN" ? "탈퇴한 사용자" : "이름 없는 멤버";
      const name = profile.displayName ?? fallback;
      return {
        accountId: Number(accountId),
        isSelf,
        name: profile.memberStatus === "KICKED" ? `${name} (내보냄)` : name,
        canStartDm: !isSelf && profile.canStartDirectMessage === true,
        online: profile.online,
        position: profile.positionLabel ?? null,
        imageUrl: profile.profileImageUrl ?? null,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "MEMBER_NOT_FOUND") return;
      throw error;
    }
  }
  const memberships = roomMembers.filter(
    (member) => member.roomId === entry.room.id && String(member.accountId) === accountId,
  );
  const member = memberships.find(isActiveMember) ?? memberships[0];
  if (!member) return;

  const account = accounts.find(({ id }) => id === member.accountId);
  const isSelf = member.accountId === entry.setup.account.id;
  if (!account || !isActiveMember(member)) {
    return {
      isSelf,
      canStartDm: false as const,
      name: account ? "방을 나간 사용자입니다" : "탈퇴한 유저입니다",
      position: null,
      imageUrl: null,
    };
  }

  const profile = getMockRoomMemberProfile(member);
  return {
    isSelf,
    canStartDm: !isSelf,
    accountId: account.id,
    online: getMockPresence(account.id),
    name: getMockRoomMemberNickname(member) ?? account.name,
    position: profile?.position ?? null,
    imageUrl: profile?.imageUrl ?? null,
  };
}
