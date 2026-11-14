"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

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

  const file = isSkipping ? null : formData.get("image");
  const image = await readProfileImage(file);
  if (image.error) return { errors: { image: image.error } };

  if (nickname.data && isNicknameTaken(entry.room.id, entry.setup.account.id, nickname.data)) {
    return { errors: { nickname: "이 워크스페이스에서 이미 사용 중인 닉네임입니다." } };
  }
  completeMockFirstRoomProfile(entry.setup.key, {
    nickname: nickname.data || null,
    imageUrl: image.imageUrl ?? null,
  });
  revalidatePath(dashboard, "layout");
  revalidatePath(`${dashboard}/first-profile`);
  redirect(dashboard);
}
