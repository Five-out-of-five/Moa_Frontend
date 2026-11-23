"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { ApiError } from "@/lib/api";

import { finishProfileUpload, getStagedProfileFile, patchRoomProfile } from "./image-server";
import { completeMockFirstRoomProfile, getFirstRoomProfile, isNicknameTaken } from "./server";
import type { FirstProfileResult } from "./types";
import { nicknameSchema, readProfileImage } from "./validation";

export async function completeFirstRoomProfileAction(
  roomId: string,
  _previous: FirstProfileResult,
  formData: FormData,
): Promise<FirstProfileResult> {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();

  const dashboard = `/rooms/${entry.room.id}`;
  if (!entry.setup?.needsSetup) redirect(dashboard);

  const isSkipping = formData.get("intent") === "skip";
  const nickname = nicknameSchema.safeParse(isSkipping ? "" : (formData.get("nickname") ?? ""));
  if (!nickname.success) return { errors: { nickname: nickname.error.issues[0].message } };

  if (entry.setup.mockKey) {
    const image = await readProfileImage(isSkipping ? null : formData.get("image"));
    if (image.error) return { errors: { image: image.error } };
    if (nickname.data && isNicknameTaken(entry.room.id, entry.setup.account.id, nickname.data)) {
      return { errors: { nickname: "이 워크스페이스에서 이미 사용 중인 닉네임입니다." } };
    }
    completeMockFirstRoomProfile(entry.setup.mockKey, {
      nickname: nickname.data || null,
      imageUrl: image.imageUrl ?? null,
    });
  } else {
    const upload = isSkipping ? null : formData.get("fileId");
    const fileId = await getStagedProfileFile(entry.room.id, upload);
    if (upload !== null && !fileId) return { errors: { image: "이미지를 다시 선택해 주세요." } };
    try {
      await patchRoomProfile(entry.room.id, {
        ...(nickname.data ? { nickname: nickname.data } : {}),
        ...(fileId ? { profileFileId: fileId } : {}),
      });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError) {
        const nicknameError = error.fields?.find(({ field }) => field === "nickname")?.reason;
        if (error.code === "MEMBER_NICKNAME_DUPLICATED" || nicknameError) {
          return { errors: { nickname: nicknameError ?? error.message } };
        }
        if (error.code.startsWith("FILE_")) return { errors: { image: error.message } };
      }
      return { message: error instanceof ApiError ? error.message : "프로필을 저장하지 못했습니다." };
    }
    if (fileId) await finishProfileUpload(entry.room.id, fileId);
  }
  revalidatePath(dashboard, "layout");
  revalidatePath(`${dashboard}/first-profile`);
  redirect(dashboard);
}
