import "server-only";

import { cookies } from "next/headers";

import { api } from "@/lib/api";

export function profileFilePath(roomId: number) {
  return `/api/v1/rooms/${roomId}/files`;
}

export function profileUploadCookie(roomId: number, fileId: number) {
  return `moa_profile_upload_${roomId}_${fileId}`;
}

export async function getStagedProfileFile(roomId: number, value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const fileId = Number(value);
  if (!Number.isSafeInteger(fileId)) return null;
  return (await cookies()).has(profileUploadCookie(roomId, fileId)) ? fileId : null;
}

export async function finishProfileUpload(roomId: number, fileId: number) {
  (await cookies()).delete(profileUploadCookie(roomId, fileId));
}

export function patchRoomProfile(
  roomId: number,
  json: { nickname?: string | null; positionLabel?: string | null; profileFileId?: number | null },
) {
  return api(`/api/v1/rooms/${roomId}/members/me/profile`, { method: "PATCH", json, cache: "no-store" });
}
