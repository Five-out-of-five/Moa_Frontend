"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import { api, ApiError } from "@/lib/api";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { adminRoomsOverlay } from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { addDefaultRoomWidgets, roomMembers, rooms } from "@/mocks/db";

import { readProfileImage } from "../first-profile/validation";
import { isRoomId } from "./api-server";
import { purgeMockRoom, retireMockMember } from "./cleanup";
import { addMockRoomMember, getMockInviteToken, roomManagementMock } from "./mock-state";
import { saveApiRoom } from "./save-api-room";
import { getManagedRoom } from "./server";
import { ROOM_CREATE_LIMIT, ROOM_MEMBER_LIMIT, type RoomManagementResult } from "./types";

const roomFields = z.object({
  name: z.string().trim().min(2).max(30),
  description: z.string().trim().max(200),
});

export async function saveManagedRoomAction(
  roomId: number | null,
  _previous: RoomManagementResult,
  form: FormData,
): Promise<RoomManagementResult> {
  if (roomId !== null && !isRoomId(roomId)) return { message: "워크스페이스를 찾을 수 없습니다." };
  const fields = (roomId === null ? roomFields : roomFields.partial()).safeParse({
    name: form.get("name") ?? undefined,
    description: form.get("description") ?? (roomId === null ? "" : undefined),
  });
  const file = form.get("image");
  const image = await readProfileImage(file, isMock);
  if (!fields.success || image.error) {
    const errors = fields.success ? undefined : fields.error.flatten().fieldErrors;
    return {
      errors: {
        name: errors?.name ? "이름은 2~30자로 입력해 주세요." : undefined,
        description: errors?.description ? "설명은 200자 이하로 입력해 주세요." : undefined,
        image: image.error,
      },
    };
  }
  const { name, description } = fields.data;
  if (!isMock) {
    return saveApiRoom(roomId, { name, description }, file instanceof File && file.size ? file : null, form.get("removeImage") === "on");
  }
  if (roomId !== null) {
    const context = await getManagedRoom(roomId);
    if (!context || !isRoomOwner(context.membership))
      return { message: "방장만 설정을 변경할 수 있습니다." };
    if (name !== undefined) context.room.name = name;
    if (description !== undefined) context.room.description = description || null;
    if (image.imageUrl || form.get("removeImage") === "on")
      context.room.imageUrl = image.imageUrl ?? null;
    revalidatePath("/", "layout");
    return { success: true, message: "워크스페이스 정보를 저장했습니다." };
  }
  if (name === undefined) return { errors: { name: "이름을 입력해 주세요." } };
  const account = await getMyAccount();
  const createdCount = rooms.filter((room) => {
    const creatorId =
      roomManagementMock.creatorIds.get(room.id) ??
      roomMembers.find(
        (member) => member.roomId === room.id && isActiveMember(member) && isRoomOwner(member),
      )?.accountId;
    return creatorId === account.id;
  }).length;
  if (createdCount >= ROOM_CREATE_LIMIT)
    return { message: "워크스페이스는 최대 10개까지 개설할 수 있습니다." };

  const id = roomManagementMock.nextRoomId++;
  rooms.push({
    id,
    name,
    description: description || null,
    imageUrl: image.imageUrl ?? null,
    memberCount: 1,
    maxMemberCount: ROOM_MEMBER_LIMIT,
    createdAt: new Date().toISOString(),
  });
  // 관리자 overlay 에도 신규 방 항목을 등록 — 등록하지 않으면 `listMockRoomsForAdmin` 와
  // `toAdminRoomDetail` 가 방을 무시해 세션 중 만든 방이 /admin/rooms 에서 보이지 않는다.
  adminRoomsOverlay.set(id, {
    status: "ACTIVE",
    lastActivityAt: new Date().toISOString(),
    reportCount: 0,
    inactiveReason: null,
    inactivatedAt: null,
    inactivatedByAccountId: null,
    creatorAccountId: account.id,
  });
  roomMembers.push(addMockRoomMember(id, account.id, "OWNER"));
  roomManagementMock.creatorIds.set(id, account.id);
  getMockInviteToken(id);
  addDefaultRoomWidgets(id);
  account.lastRoomId = id;
  revalidatePath("/", "layout");
  redirect(`/rooms/${id}`);
}

export async function deleteManagedRoomAction(
  roomId: number,
  _previous: RoomManagementResult,
  form: FormData,
): Promise<RoomManagementResult> {
  if (!isRoomId(roomId)) return { message: "워크스페이스를 찾을 수 없습니다." };
  if (!isMock) {
    const confirmName = form.get("confirmation");
    if (typeof confirmName !== "string" || !confirmName) return { errors: { confirmation: "워크스페이스 이름을 입력해 주세요." } };
    try {
      await api(`/api/v1/rooms/${roomId}`, { method: "DELETE", json: { confirmName }, cache: "no-store" });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError && error.code === "ROOM_DELETE_CONFIRM_MISMATCH") {
        return { errors: { confirmation: error.message } };
      }
      return { message: error instanceof ApiError ? error.message : "워크스페이스를 삭제하지 못했습니다." };
    }
    revalidatePath("/", "layout");
    redirect("/workspaces");
  }
  const context = await getManagedRoom(roomId);
  if (!context || !isRoomOwner(context.membership))
    return { message: "방장만 워크스페이스를 삭제할 수 있습니다." };
  if (form.get("confirmation") !== context.room.name) {
    return { errors: { confirmation: "워크스페이스 이름을 정확히 입력해 주세요." } };
  }
  purgeMockRoom(roomId);
  revalidatePath("/", "layout");
  redirect("/workspaces/manage");
}

export async function updateManagedMemberAction(
  roomId: number,
  accountId: number,
  operation: "transfer" | "remove",
): Promise<RoomManagementResult> {
  if (!isRoomId(roomId) || !isRoomId(accountId) || (operation !== "transfer" && operation !== "remove")) {
    return { message: "멤버 관리 요청을 확인해 주세요." };
  }
  if (!isMock) {
    try {
      const path = `/api/v1/rooms/${roomId}`;
      if (operation === "transfer") {
        await api(`${path}/delegate-owner`, { method: "POST", json: { targetAccountId: accountId }, cache: "no-store" });
      } else {
        await api(`${path}/members/${accountId}`, { method: "DELETE", cache: "no-store" });
      }
    } catch (error) {
      unstable_rethrow(error);
      return { message: error instanceof ApiError ? error.message : "멤버 정보를 변경하지 못했습니다." };
    }
    revalidatePath("/", "layout");
    return { success: true, message: operation === "transfer" ? "방장 권한을 위임했습니다." : "멤버를 내보냈습니다." };
  }
  const context = await getManagedRoom(roomId);
  if (!context || !isRoomOwner(context.membership))
    return { message: "방장만 멤버를 관리할 수 있습니다." };
  const target = roomMembers.find(
    (member) =>
      member.roomId === roomId && member.accountId === accountId && isActiveMember(member),
  );
  if (!target || isRoomOwner(target)) return { message: "대상 멤버를 확인해 주세요." };
  if (operation === "transfer") {
    if (!roomManagementMock.creatorIds.has(roomId)) {
      roomManagementMock.creatorIds.set(roomId, context.account.id);
    }
    context.membership.role = "MEMBER";
    target.role = "OWNER";
  } else if (operation === "remove") {
    retireMockMember(target, "KICKED");
    context.room.memberCount -= 1;
  } else {
    return { message: "멤버 관리 요청을 확인해 주세요." };
  }
  revalidatePath("/", "layout");
  return {
    success: true,
    message: operation === "transfer" ? "방장 권한을 위임했습니다." : "멤버를 내보냈습니다.",
  };
}
