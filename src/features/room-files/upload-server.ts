import "server-only";

import { api, ApiError } from "@/lib/api";
import type { components } from "@/types/api";

type FileResponse = components["schemas"]["FileResponse"];
type FilePurpose = NonNullable<FileResponse["purpose"]>;
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const attachmentExtensions = new Set([
  ...imageExtensions, "gif", "pdf", "docx", "xlsx", "pptx", "txt", "md", "zip",
]);

export function validateRoomUpload(purpose: FilePurpose, file: File) {
  const isProfileOrRoomImage = purpose === "PROFILE_IMAGE" || purpose === "ROOM_IMAGE";
  const extensions = isProfileOrRoomImage ? imageExtensions : attachmentExtensions;
  const limitMb = isProfileOrRoomImage ? 5 : 20;
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!file.name.includes(".") || !extension || !extensions.has(extension) || !file.size) {
    throw new ApiError(400, "지원하는 형식의 파일을 선택해 주세요.", "FILE_TYPE_NOT_ALLOWED");
  }
  if (file.size > limitMb * 1024 ** 2) {
    throw new ApiError(413, `파일은 ${limitMb}MB까지 올릴 수 있어요.`, "FILE_SIZE_EXCEEDED");
  }
}

export async function uploadRoomFile(roomId: number, purpose: FilePurpose, file: File) {
  validateRoomUpload(purpose, file);
  const body = new FormData();
  body.set("file", file);
  const result = await api<FileResponse>(`/api/v1/rooms/${roomId}/files?purpose=${purpose}`, {
    method: "POST",
    body,
    cache: "no-store",
  });
  if (result.fileId == null || !Number.isSafeInteger(result.fileId) || result.fileId < 1) {
    throw new ApiError(502, "업로드한 파일 정보를 확인하지 못했어요.", "FILE_UPLOAD_RESPONSE_INVALID");
  }
  return { ...result, fileId: result.fileId };
}

export async function discardRoomFileUpload(roomId: number, fileId: number) {
  await api<null>(`/api/v1/rooms/${roomId}/files/${fileId}`, { method: "DELETE", cache: "no-store" });
}
