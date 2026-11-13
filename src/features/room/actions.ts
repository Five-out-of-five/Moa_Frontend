"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import type { SettingsResult } from "@/features/account/settings-types";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { roomMembers, rooms, tasks } from "@/mocks/db";

export async function leaveRoomAction(
  roomId: number,
): Promise<SettingsResult> {
  if (!z.number().int().positive().safeParse(roomId).success) {
    return { success: false, message: "워크스페이스를 찾을 수 없습니다." };
  }
  if (!isMock) {
    return { success: false, message: "현재 환경에서는 워크스페이스를 나갈 수 없습니다." };
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
