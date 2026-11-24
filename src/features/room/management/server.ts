import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getExplicitMockAccount, getMyAccount } from "@/features/account/server";
import { requireAuthSession } from "@/features/auth/guard";
import { api, ApiError } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers, rooms } from "@/mocks/db";
import type { components } from "@/types/api";

import { getMockRoomMemberNickname, getMockRoomMemberProfile } from "../first-profile/server";
import { getApiRoomManagement } from "./api-server";
import {
  getMockInviteToken,
  isPendingJoinRequest,
  requestKey,
  roomManagementMock,
} from "./mock-state";
import { type JoinRequestStatus,ROOM_MEMBER_LIMIT } from "./types";

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

export async function getRoomManagement(roomId: number, status: JoinRequestStatus, page: number, showMembers: boolean) {
  if (!isMock) return getApiRoomManagement(roomId, status, page, showMembers);
  const context = await getManagedRoom(roomId);
  if (!context) return null;
  const isOwner = isRoomOwner(context.membership);
  const members = roomMembers
    .filter((member) => member.roomId === roomId && isActiveMember(member))
    .map((member) => {
      const profile = getMockRoomMemberProfile(member);
      return {
        accountId: member.accountId,
        name: getMockRoomMemberNickname(member) ?? "탈퇴한 유저",
        imageUrl: profile?.imageUrl,
        position: profile?.position ?? null,
        isOwner: isRoomOwner(member),
      };
    });
  const requests = isOwner
    ? [...roomManagementMock.requests.values()]
        .filter((request) => request.roomId === roomId && isPendingJoinRequest(request))
        .map((request) => ({
          id: (request.id ??= randomUUID()),
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
    invitePath: isOwner ? `/invite/${getMockInviteToken(roomId)}` : null,
    inviteUrl: null,
    requestStatus: "PENDING" as const,
    requestPage: 0,
    supportsRequestFilters: false,
    hasNextRequestPage: false,
  };
}

export async function getRoomInvite(token: string) {
  if (!isMock) {
    const jar = await cookies();
    if (!jar.has(process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken") && !jar.has("refreshToken")) {
      return { kind: "login" as const };
    }
    await requireAuthSession();
    try {
      const preview = await api<components["schemas"]["InvitePreviewResponse"]>(
        `/api/v1/invites/${encodeURIComponent(token)}`, { cache: "no-store" },
      );
      if (preview.roomId == null || preview.name == null) throw new Error("초대 응답이 올바르지 않습니다.");
      if (!preview.myStatus || !["NONE", "PENDING", "MEMBER", "KICKED", "FULL"].includes(preview.myStatus)) {
        throw new Error("초대 참여 상태를 확인하지 못했습니다.");
      }
      return {
        kind: "preview" as const,
        room: {
          id: preview.roomId, name: preview.name, description: preview.description ?? null,
          imageUrl: preview.imageUrl ?? null, memberCount: preview.memberCount ?? 0, maxMemberCount: ROOM_MEMBER_LIMIT,
        },
        account: null,
        isLoggedIn: true,
        isMember: preview.myStatus === "MEMBER",
        isKicked: preview.myStatus === "KICKED",
        isFull: preview.myStatus === "FULL",
        requestStatus: preview.myStatus === "PENDING" ? "PENDING" as const : undefined,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVITE_CODE_NOT_FOUND") return null;
      if (error instanceof ApiError && error.code === "ROOM_INACTIVE") return { kind: "inactive" as const };
      throw error;
    }
  }
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
    kind: "mock" as const,
    room,
    account,
    isLoggedIn: !!account,
    isFull: room.memberCount >= room.maxMemberCount,
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
