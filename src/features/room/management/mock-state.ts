import "server-only";

import { randomUUID } from "node:crypto";

import type { RoomMember } from "@/types/db";

export interface JoinRequest {
  roomId: number;
  accountId: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: number;
}

const runtime = globalThis as typeof globalThis & {
  moaRoomManagement?: {
    inviteTokens: Map<number, string>;
    requests: Map<string, JoinRequest>;
    newMemberships: Set<number>;
    creatorIds: Map<number, number>;
    nextRoomId: number;
    nextMemberId: number;
  };
};

export const roomManagementMock = (runtime.moaRoomManagement ??= {
  inviteTokens: new Map<number, string>(),
  requests: new Map<string, JoinRequest>(),
  newMemberships: new Set<number>(),
  creatorIds: new Map<number, number>(),
  nextRoomId: 100,
  nextMemberId: 100,
});

export function getMockInviteToken(roomId: number) {
  const existing = roomManagementMock.inviteTokens.get(roomId);
  if (existing) return existing;
  const token = randomUUID();
  roomManagementMock.inviteTokens.set(roomId, token);
  return token;
}

export function requestKey(roomId: number, accountId: number) {
  return `${roomId}:${accountId}`;
}

export function isPendingJoinRequest(request: JoinRequest) {
  return request.status === "PENDING" && Date.now() - request.requestedAt < 7 * 24 * 60 * 60 * 1000;
}

export function addMockRoomMember(
  roomId: number,
  accountId: number,
  role: RoomMember["role"],
): RoomMember {
  const id = roomManagementMock.nextMemberId++;
  if (role === "MEMBER") roomManagementMock.newMemberships.add(id);
  return {
    id,
    roomId,
    accountId,
    role,
    state: "ACTIVE",
    nickname: null,
    notificationMuted: false,
    lastBriefingCheckedAt: null,
    joinedAt: new Date().toISOString(),
  };
}
