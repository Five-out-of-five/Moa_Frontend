"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  const image = await readProfileImage(data.get("image"));
  if (!nickname.success || !position.success || image.error) {
    return {
      errors: {
        nickname: nickname.success ? undefined : nickname.error.issues[0].message,
        position: position.success ? undefined : "직책은 20자까지 입력할 수 있습니다.",
        image: image.error,
      },
    };
  }

  const { account, key, profile } = entry.setup;
  if (nickname.data && isNicknameTaken(entry.room.id, account.id, nickname.data)) {
    return { errors: { nickname: "이 워크스페이스에서 이미 사용 중인 닉네임입니다." } };
  }

  updateMockRoomProfile(key, {
    nickname: nickname.data || null,
    position: position.data || null,
    imageUrl:
      image.imageUrl ?? (data.get("removeImage") === "on" ? null : (profile?.imageUrl ?? null)),
  });
  revalidatePath("/", "layout");
  return { success: true, message: "워크스페이스 프로필을 저장했습니다." };
}
