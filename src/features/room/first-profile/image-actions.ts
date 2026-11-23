"use server";

import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";

import { finishProfileUpload, getStagedProfileFile, profileFilePath, profileUploadCookie } from "./image-server";
import { getFirstRoomProfile } from "./server";
import { readProfileImage } from "./validation";

export async function uploadProfileImageAction(roomId: string, form: FormData) {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup) return { error: "이 워크스페이스의 프로필을 수정할 수 없습니다." };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "이미지를 선택해 주세요." };
  const image = await readProfileImage(file, isMock);
  if (image.error) return { error: image.error };
  if (isMock) return { previewUrl: image.imageUrl ?? undefined };
  try {
    const body = new FormData();
    body.set("file", file);
    const { fileId, previewUrl } = await api<{ fileId: number; previewUrl: string }>(
      `${profileFilePath(entry.room.id)}?purpose=PROFILE_IMAGE`,
      { method: "POST", body, cache: "no-store" },
    );
    if (!Number.isSafeInteger(fileId) || fileId <= 0 || !previewUrl) {
      return { error: "이미지 업로드 응답을 확인하지 못했습니다." };
    }
    (await cookies()).set(profileUploadCookie(entry.room.id, fileId), "1", {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      maxAge: 1800,
    });
    return { fileId, previewUrl };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : "이미지를 올리지 못했습니다." };
  }
}

export async function discardProfileImageAction(roomId: string, fileId: number) {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || isMock) return {};
  const staged = await getStagedProfileFile(entry.room.id, String(fileId));
  if (!staged) return { error: "취소할 이미지를 찾을 수 없습니다." };
  try {
    await api(`${profileFilePath(entry.room.id)}/${staged}`, { method: "DELETE", cache: "no-store" });
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof ApiError && error.code === "FILE_NOT_FOUND")) {
      return { error: error instanceof ApiError ? error.message : "이미지를 삭제하지 못했습니다." };
    }
  }
  await finishProfileUpload(entry.room.id, staged);
  return {};
}
