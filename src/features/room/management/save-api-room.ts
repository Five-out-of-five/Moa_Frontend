import "server-only";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { isRoomOwner } from "@/lib/permission";
import type { components } from "@/types/api";

import { getRoomDetail, isRoomId } from "./api-server";
import type { RoomManagementResult } from "./types";

export async function saveApiRoom(
  roomId: number | null,
  fields: { name?: string; description?: string },
  file: File | null,
  shouldRemoveImage: boolean,
): Promise<RoomManagementResult> {
  let createdId: number | undefined;
  try {
    if (roomId === null) {
      const body = new FormData();
      body.set("request", new Blob([JSON.stringify(fields)], { type: "application/json" }));
      if (file) body.set("image", file);
      const result = await api<components["schemas"]["RoomDetailResponse"]>("/api/v1/rooms", {
        method: "POST",
        body,
        cache: "no-store",
      });
      if (result.roomId == null || !isRoomId(result.roomId))
        throw new Error("워크스페이스 번호를 받지 못했습니다.");
      createdId = result.roomId;
    } else {
      const detail = await getRoomDetail(roomId);
      const role = detail.myMembership?.role;
      if (!role || !isRoomOwner({ role })) return { message: "방장만 설정을 변경할 수 있습니다." };
      const path = `/api/v1/rooms/${roomId}`;
      const json: { name?: string; description?: string; imageFileId?: number | null } = {};
      if (fields.name !== undefined && fields.name !== detail.name) json.name = fields.name;
      if (fields.description !== undefined && fields.description !== (detail.description ?? ""))
        json.description = fields.description;
      if (file) {
        const body = new FormData();
        body.set("file", file);
        const uploaded = await api<components["schemas"]["FileResponse"]>(
          `${path}/files?purpose=ROOM_IMAGE`,
          { method: "POST", body, cache: "no-store" },
        );
        if (uploaded.fileId == null || !isRoomId(uploaded.fileId))
          throw new Error("이미지 파일 번호를 받지 못했습니다.");
        json.imageFileId = uploaded.fileId;
      } else if (shouldRemoveImage) json.imageFileId = null;
      if (Object.keys(json).length) await api(path, { method: "PATCH", json, cache: "no-store" });
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const field = (name: string) => error.fields?.find((item) => item.field === name)?.reason;
      const errors = {
        name: field("name"),
        description: field("description"),
        image: error.code.startsWith("FILE_")
          ? error.message
          : (field("image") ?? field("imageFileId")),
      };
      if (Object.values(errors).some(Boolean)) return { errors };
    }
    return {
      message:
        error instanceof ApiError ? error.message : "워크스페이스 정보를 저장하지 못했습니다.",
    };
  }
  revalidatePath("/", "layout");
  if (createdId) redirect(`/rooms/${createdId}`);
  return { success: true, message: "워크스페이스 정보를 저장했습니다." };
}
