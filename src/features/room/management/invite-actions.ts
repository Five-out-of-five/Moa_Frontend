"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { roomMembers, rooms } from "@/mocks/db";

import { isRoomId } from "./api-server";
import {
  addMockRoomMember,
  isPendingJoinRequest,
  requestKey,
  roomManagementMock,
} from "./mock-state";
import { getManagedRoom, getRoomInvite } from "./server";
import type { RoomManagementResult } from "./types";

export async function requestRoomJoinAction(token: string): Promise<RoomManagementResult> {
  if (typeof token !== "string" || !/^[\w-]+$/.test(token)) return { message: "초대 링크를 확인해 주세요." };
  if (!isMock) {
    try {
      await api(`/api/v1/invites/${encodeURIComponent(token)}/join-requests`, { method: "POST", cache: "no-store" });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError && error.code === "JOIN_ALREADY_MEMBER") {
        const data = error.data;
        if (data && typeof data === "object" && "roomId" in data && typeof data.roomId === "number" && isRoomId(data.roomId)) {
          redirect(`/rooms/${data.roomId}`);
        }
      }
      if (error instanceof ApiError && error.code === "JOIN_REQUEST_ALREADY_PENDING") revalidatePath(`/invite/${token}`);
      return { message: error instanceof ApiError ? error.message : "참여 요청을 보내지 못했습니다." };
    }
    revalidatePath(`/invite/${token}`);
    return { success: true, message: "참여 요청을 보냈습니다." };
  }
  const invite = await getRoomInvite(token);
  if (invite?.kind !== "mock" || !invite.account || !rooms.includes(invite.room))
    return { message: "초대 링크나 로그인 상태를 확인해 주세요." };
  const { room, account } = invite;
  if (invite.isMember) redirect(`/rooms/${room.id}`);
  if (invite.isKicked) return { message: "이 워크스페이스에는 다시 참여할 수 없습니다." };
  const key = requestKey(room.id, account.id);
  const existing = roomManagementMock.requests.get(key);
  if (existing && isPendingJoinRequest(existing))
    return { message: "이미 대기 중인 요청이 있습니다." };
  if (room.memberCount >= room.maxMemberCount)
    return { message: "워크스페이스 정원이 가득 찼습니다." };
  roomManagementMock.requests.set(key, {
    id: randomUUID(),
    roomId: room.id,
    accountId: account.id,
    status: "PENDING",
    requestedAt: Date.now(),
  });
  revalidatePath("/", "layout");
  return { success: true, message: "참여 요청을 보냈습니다." };
}

export async function decideRoomJoinAction(
  roomId: number,
  accountId: number,
  requestId: string,
  approve: boolean,
): Promise<RoomManagementResult> {
  if (!isMock) {
    if (!isRoomId(roomId) || !/^[1-9]\d*$/.test(requestId) || !isRoomId(Number(requestId)) || typeof approve !== "boolean") {
      return { message: "참여 요청을 확인해 주세요." };
    }
    const operation = approve ? "approve" : "reject";
    try {
      await api(`/api/v1/rooms/${roomId}/join-requests/${requestId}/${operation}`, { method: "POST", cache: "no-store" });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError && error.code === "JOIN_REQUEST_ALREADY_PROCESSED") revalidatePath("/workspaces/manage");
      return { message: error instanceof ApiError ? error.message : "참여 요청을 처리하지 못했습니다." };
    }
    revalidatePath("/", "layout");
    return { success: true, message: approve ? "참여 요청을 승인했습니다." : "참여 요청을 거절했습니다." };
  }
  const context = await getManagedRoom(roomId);
  if (!context || !isRoomOwner(context.membership))
    return { message: "방장만 참여 요청을 처리할 수 있습니다." };
  const request = roomManagementMock.requests.get(requestKey(roomId, accountId));
  if (!request || !requestId || request.id !== requestId || !isPendingJoinRequest(request))
    return { message: "이미 처리됐거나 만료된 요청입니다." };
  if (approve) {
    if (context.room.memberCount >= context.room.maxMemberCount)
      return { message: "워크스페이스 정원이 가득 찼습니다." };
    if (
      roomMembers.some(
        (member) =>
          member.roomId === roomId && member.accountId === accountId && member.state !== "LEFT",
      )
    ) {
      return { message: "이 사용자는 새로 참여할 수 없습니다." };
    }
    roomMembers.push(addMockRoomMember(roomId, accountId, "MEMBER"));
    context.room.memberCount += 1;
  }
  request.status = approve ? "APPROVED" : "REJECTED";
  revalidatePath("/", "layout");
  return {
    success: true,
    message: approve ? "참여 요청을 승인했습니다." : "참여 요청을 거절했습니다.",
  };
}
