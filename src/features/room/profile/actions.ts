"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api";

import { finishProfileUpload, getStagedProfileFile, patchRoomProfile } from "../first-profile/image-server";
import {
  getFirstRoomProfile,
  isNicknameTaken,
  updateMockRoomProfile,
} from "../first-profile/server";
import { nicknameSchema, readProfileImage } from "../first-profile/validation";
import type { RoomProfileResult } from "./types";

export async function updateRoomProfileAction(
  roomId: string,
  _previous: RoomProfileResult,
  data: FormData,
): Promise<RoomProfileResult> {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || entry.setup.needsSetup) {
    return { message: "이 워크스페이스의 프로필을 수정할 수 없습니다." };
  }

  const nickname = nicknameSchema.safeParse(data.get("nickname") ?? "");
  const position = z
    .string()
    .trim()
    .max(20)
    .safeParse(data.get("position") ?? "");
  if (!nickname.success || !position.success) {
    return {
      errors: {
        nickname: nickname.success ? undefined : nickname.error.issues[0].message,
        position: position.success ? undefined : "직책은 20자까지 입력할 수 있습니다.",
      },
    };
  }

  const { account, mockKey, member, profile } = entry.setup;
  const removesImage = data.get("removeImage") === "on";
  if (mockKey) {
    const image = await readProfileImage(data.get("image"));
    if (image.error) return { errors: { image: image.error } };
    if (data.has("nickname") && nickname.data && isNicknameTaken(entry.room.id, account.id, nickname.data)) {
      return { errors: { nickname: "이 워크스페이스에서 이미 사용 중인 닉네임입니다." } };
    }
    updateMockRoomProfile(mockKey, {
      nickname: data.has("nickname") ? nickname.data || null : profile ? profile.nickname : member.nickname,
      position: data.has("position") ? position.data || null : profile?.position ?? null,
      imageUrl: image.imageUrl ?? (removesImage ? null : (profile?.imageUrl ?? null)),
    });
  } else {
    const upload = data.get("fileId");
    const fileId = await getStagedProfileFile(entry.room.id, upload);
    if (upload !== null && !fileId) return { errors: { image: "이미지를 다시 선택해 주세요." } };
    const json = {
      ...(data.has("nickname") && (nickname.data || null) !== member.nickname ? { nickname: nickname.data || null } : {}),
      ...(data.has("position") && (position.data || null) !== (profile?.position ?? null) ? { positionLabel: position.data || null } : {}),
      ...(fileId ? { profileFileId: fileId } : removesImage ? { profileFileId: null } : {}),
    };
    try {
      if (Object.keys(json).length) await patchRoomProfile(entry.room.id, json);
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError) {
        const fieldError = (name: string) => error.fields?.find(({ field }) => field === name)?.reason;
        const errors = {
          nickname: error.code === "MEMBER_NICKNAME_DUPLICATED" ? error.message : fieldError("nickname"),
          position: fieldError("positionLabel"),
          image: error.code.startsWith("FILE_") ? error.message : fieldError("profileFileId"),
        };
        if (Object.values(errors).some(Boolean)) return { errors };
      }
      return { message: error instanceof ApiError ? error.message : "프로필을 저장하지 못했습니다." };
    }
    if (fileId) await finishProfileUpload(entry.room.id, fileId);
  }
  revalidatePath("/", "layout");
  return { success: true, message: "워크스페이스 프로필을 저장했습니다." };
}
