import "server-only";

import { z } from "zod";

import { PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_TYPES } from "./types";

export const nicknameSchema = z
  .string()
  .trim()
  .refine(
    (nickname) =>
      !nickname ||
      (nickname.length >= 2 && nickname.length <= 20 && /^[\p{L}\p{M}\p{N} ]+$/u.test(nickname)),
    "닉네임은 특수문자 없이 2~20자로 입력해 주세요.",
  );

export async function readProfileImage(file: FormDataEntryValue | null) {
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (
      file.size > PROFILE_IMAGE_MAX_BYTES ||
      !PROFILE_IMAGE_TYPES.some((type) => type === file.type)
    ) {
      return { error: "JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const matchesType =
      (file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
      (file.type === "image/png" &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.type === "image/webp" &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP");
    if (!matchesType) return { error: "이미지 파일 형식을 확인해 주세요." };
    imageUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  }
  return { imageUrl };
}
