import "server-only";

import { getExplicitMockAccount, getMyAccount } from "@/features/account/server";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers, rooms } from "@/mocks/db";

import { getMockRoomMemberProfile } from "../first-profile/server";
import {
  getMockInviteToken,
  isPendingJoinRequest,
  requestKey,
  roomManagementMock,
} from "./mock-state";

export async function getManagedRoom(roomId: number) {
  if (!isMock) return null;
  const account = await getMyAccount();
  const room = rooms.find(({ id }) => id === roomId);
  const membership = roomMembers.find(
    (member) =>
      member.roomId === roomId && member.accountId === account.id && isActiveMember(member),
  );
  return room && membership ? { room, account, membership } : null;
}

export async function getRoomManagement(roomId: number) {
  const context = await getManagedRoom(roomId);
  if (!context) return null;
  const isOwner = isRoomOwner(context.membership);
  const members = roomMembers
    .filter((member) => member.roomId === roomId && isActiveMember(member))
    .map((member) => {
      const profile = getMockRoomMemberProfile(member);
      const account = accounts.find(({ id }) => id === member.accountId);
      return {
        accountId: member.accountId,
        name: (profile ? profile.nickname : member.nickname) ?? account?.name ?? "탈퇴한 유저",
        position: profile?.position ?? null,
        isOwner: isRoomOwner(member),
      };
    });
  const requests = isOwner
    ? [...roomManagementMock.requests.values()]
        .filter((request) => request.roomId === roomId && isPendingJoinRequest(request))
        .map((request) => ({
          accountId: request.accountId,
          name: accounts.find(({ id }) => id === request.accountId)?.name ?? "탈퇴한 유저",
          requestedAt: new Date(request.requestedAt).toISOString(),
        }))
    : [];
  return {
    ...context,
    isOwner,
    members,
    requests,
    inviteToken: isOwner ? getMockInviteToken(roomId) : null,
  };
}

export async function getRoomInvite(token: string) {
  if (!isMock) return null;
  const id = [...roomManagementMock.inviteTokens].find(([, value]) => value === token)?.[0];
  if (id === undefined) return null;
  const room = rooms.find((room) => room.id === id);
  if (!room) return null;
  const account = await getExplicitMockAccount();
  const memberships = account
    ? roomMembers.filter((member) => member.roomId === id && member.accountId === account.id)
    : [];
  const request = account ? roomManagementMock.requests.get(requestKey(id, account.id)) : undefined;
  return {
    room,
    account,
    isMember: memberships.some(isActiveMember),
    isKicked: memberships.some(({ state }) => state === "KICKED"),
    requestStatus:
      request?.status === "PENDING" && !isPendingJoinRequest(request) ? "EXPIRED" : request?.status,
  };
}

export async function listMyParticipationResults() {
  const account = await getExplicitMockAccount();
  if (!account) return [];
  return [...roomManagementMock.requests.values()].flatMap((request) => {
    if (request.accountId !== account.id || request.status === "PENDING") return [];
    const room = rooms.find(({ id }) => id === request.roomId);
    const isActive = roomMembers.some(
      (member) =>
        member.roomId === request.roomId &&
        member.accountId === account.id &&
        isActiveMember(member),
    );
    if (!room || (request.status === "APPROVED" && !isActive)) return [];
    return [{ roomId: room.id, name: room.name, approved: request.status === "APPROVED" }];
  });
}
