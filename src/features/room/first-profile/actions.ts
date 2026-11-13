"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { completeMockFirstRoomProfile, getFirstRoomProfile, isNicknameTaken } from "./server";
import { type FirstProfileResult, PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_TYPES } from "./types";

const nicknameSchema = z
  .string()
  .trim()
  .refine(
    (nickname) =>
      !nickname ||
      (nickname.length >= 2 && nickname.length <= 20 && /^[\p{L}\p{M}\p{N} ]+$/u.test(nickname)),
    "닉네임은 특수문자 없이 2~20자로 입력해 주세요.",
  );

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

  const file = isSkipping ? null : formData.get("image");
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (
      file.size > PROFILE_IMAGE_MAX_BYTES ||
      !PROFILE_IMAGE_TYPES.some((type) => type === file.type)
    ) {
      return { errors: { image: "JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요." } };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const matchesType =
      (file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
      (file.type === "image/png" &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.type === "image/webp" &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP");
    if (!matchesType) return { errors: { image: "이미지 파일 형식을 확인해 주세요." } };
    imageUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  if (nickname.data && isNicknameTaken(entry.room.id, entry.setup.account.id, nickname.data)) {
    return { errors: { nickname: "이 워크스페이스에서 이미 사용 중인 닉네임입니다." } };
  }
  completeMockFirstRoomProfile(entry.setup.key, { nickname: nickname.data || null, imageUrl });
  revalidatePath(dashboard, "layout");
  revalidatePath(`${dashboard}/first-profile`);
  redirect(dashboard);
}
