"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import type { SettingsResult } from "@/features/account/settings-types";
import { api, ApiError } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { roomMembers, rooms, tasks } from "@/mocks/db";
import type { components } from "@/types/api";

import { getFirstRoomProfile } from "./first-profile/server";
import { isRoomId } from "./management/api-server";

export async function checkRoomLeaveAction(roomId: number) {
  if (!isRoomId(roomId)) return { error: "워크스페이스를 찾을 수 없습니다." };
  try {
    if (!isMock) {
      const result = await api<components["schemas"]["LeaveCheckResponse"]>(
        `/api/v1/rooms/${roomId}/members/me/leave-check`, { cache: "no-store" },
      );
      return { leavable: result.leavable === true, isOwner: result.isOwner === true, count: result.assignedOpenTaskCount ?? 0 };
    }
    const account = await getMyAccount();
    const member = roomMembers.find((item) => item.roomId === roomId && item.accountId === account.id && isActiveMember(item));
    if (!member) return { error: "참여 중인 워크스페이스를 찾을 수 없습니다." };
    const isOwner = isRoomOwner(member);
    const count = tasks.filter((task) => task.roomId === roomId && task.assignee?.accountId === account.id && task.status !== "DONE").length;
    return { leavable: !isOwner, isOwner, count };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : "나가기 가능 여부를 확인하지 못했습니다." };
  }
}

export async function recordLastRoomAction(roomId: number) {
  if (!Number.isSafeInteger(roomId) || roomId < 1) return;
  const entry = await getFirstRoomProfile(String(roomId));
  if (!entry?.setup || entry.setup.needsSetup) return;
  if (isMock) entry.setup.account.lastRoomId = roomId;
  else await api("/api/v1/accounts/me/last-room", { method: "PUT", json: { roomId }, cache: "no-store" });
}

export async function leaveRoomAction(
  roomId: number,
): Promise<SettingsResult> {
  if (!z.number().int().positive().safeParse(roomId).success) {
    return { success: false, message: "워크스페이스를 찾을 수 없습니다." };
  }
  if (!isMock) {
    try {
      await api(`/api/v1/rooms/${roomId}/members/me`, { method: "DELETE", cache: "no-store" });
    } catch (error) {
      unstable_rethrow(error);
      return { success: false, message: error instanceof ApiError ? error.message : "워크스페이스에서 나가지 못했습니다." };
    }
    revalidatePath("/", "layout");
    return { success: true, message: "워크스페이스에서 나왔습니다." };
  }
  const account = await getMyAccount();
  const member = roomMembers.find(
    (member) =>
      member.roomId === roomId && member.accountId === account.id && isActiveMember(member),
  );
  const room = rooms.find((room) => room.id === roomId);
  if (!member || !room) {
    return { success: false, message: "참여 중인 워크스페이스를 찾을 수 없습니다." };
  }
  if (isRoomOwner(member)) {
    return { success: false, message: "방장 권한을 위임한 후 나갈 수 있습니다." };
  }

  member.state = "LEFT";
  member.nickname = null;
  member.notificationMuted = false;
  room.memberCount -= 1;
  if (account.lastRoomId === roomId) account.lastRoomId = null;
  for (const task of tasks) {
    if (task.roomId === roomId && task.assignee?.accountId === account.id) {
      task.assignee = null;
      task.version += 1;
    }
  }
  revalidatePath("/", "layout");
  return { success: true, message: "워크스페이스에서 나왔습니다." };
}
