"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import { isActiveMember, isRoomOwner } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { addDefaultRoomWidgets, roomMembers, rooms } from "@/mocks/db";

import { readProfileImage } from "../first-profile/validation";
import { purgeMockRoom, retireMockMember } from "./cleanup";
import { addMockRoomMember, getMockInviteToken, roomManagementMock } from "./mock-state";
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
  if (!isMock) return { message: "현재 환경에서는 워크스페이스를 저장할 수 없습니다." };
  const fields = roomFields.safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
  });
  const image = await readProfileImage(form.get("image"));
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
  if (roomId !== null) {
    const context = await getManagedRoom(roomId);
    if (!context || !isRoomOwner(context.membership))
      return { message: "방장만 설정을 변경할 수 있습니다." };
    context.room.name = name;
    context.room.description = description || null;
    if (image.imageUrl || form.get("removeImage") === "on")
      context.room.imageUrl = image.imageUrl ?? null;
    revalidatePath("/", "layout");
    return { success: true, message: "워크스페이스 정보를 저장했습니다." };
  }
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
