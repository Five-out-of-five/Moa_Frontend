"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { isRoomId } from "@/features/room/management/api-server";
import { discardRoomFileUpload, uploadRoomFile } from "@/features/room-files/upload-server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";

function failure(error: unknown) {
  unstable_rethrow(error);
  return { error: error instanceof ApiError ? error.message : "첨부 파일을 변경하지 못했어요." };
}

/**
 * 업무 첨부 업로드(1단계) — 공용 `uploadRoomFile` 로 TASK_ATTACHMENT 올리고 fileId 만 돌려준다.
 * 성공 후 2단계에서 업무에 attach, 실패하면 `discardRoomFileUpload` 로 cleanup — idea 패턴 동일.
 */
export async function stageTaskFile(
  roomId: number,
  data: FormData,
): Promise<{ fileId: number; error?: never } | { fileId?: never; error: string }> {
  const file = data.get("file");
  if (isMock || !isRoomId(roomId) || !(file instanceof File)) {
    return { error: "첨부 파일을 확인해 주세요." };
  }
  try {
    return { fileId: (await uploadRoomFile(roomId, "TASK_ATTACHMENT", file)).fileId };
  } catch (error) {
    return failure(error);
  }
}

export async function discardTaskFile(roomId: number, fileId: number) {
  if (isMock || !isRoomId(roomId) || !isRoomId(fileId)) return;
  try {
    await discardRoomFileUpload(roomId, fileId);
  } catch (error) {
    unstable_rethrow(error);
  }
}

/**
 * 업로드 → 업무에 attach — 명세 `POST /api/v1/rooms/{roomId}/tasks/{taskId}/files` body `{fileId}`.
 * attach 실패 시 업로드 파일을 바로 폐기한다 (고아 파일 방지).
 */
export async function attachTaskFile(roomId: number, taskId: number, data: FormData) {
  if (!isRoomId(taskId)) return { error: "업무를 확인해 주세요." };
  const upload = await stageTaskFile(roomId, data);
  if (!upload.fileId) return { error: upload.error };
  try {
    await api(`/api/v1/rooms/${roomId}/tasks/${taskId}/files`, {
      method: "POST",
      json: { fileId: upload.fileId },
    });
    revalidatePath(`/rooms/${roomId}/boards/task`);
    return { saved: true };
  } catch (error) {
    await discardTaskFile(roomId, upload.fileId);
    return failure(error);
  }
}

/** 업무 첨부 삭제 — 명세 `DELETE /api/v1/rooms/{roomId}/tasks/{taskId}/files/{fileId}`. */
export async function removeTaskFile(roomId: number, taskId: number, fileId: number) {
  if (isMock || !isRoomId(roomId) || !isRoomId(taskId) || !isRoomId(fileId)) {
    return { error: "첨부 파일을 확인해 주세요." };
  }
  try {
    await api(`/api/v1/rooms/${roomId}/tasks/${taskId}/files/${fileId}`, {
      method: "DELETE",
    });
    revalidatePath(`/rooms/${roomId}/boards/task`);
    return { saved: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * 다운로드 presigned URL 조회 — 명세 `GET /api/v1/rooms/{roomId}/files/{fileId}/download-url`.
 * 클라이언트가 받은 URL 로 `window.open` 하면 S3 등 외부 저장소에서 파일 받기 시작.
 */
export async function getTaskFileDownloadUrl(roomId: number, fileId: number) {
  if (isMock || !isRoomId(roomId) || !isRoomId(fileId)) {
    return { error: "파일을 확인해 주세요." };
  }
  try {
    const result = await api<{ url: string }>(
      `/api/v1/rooms/${roomId}/files/${fileId}/download-url`,
      { cache: "no-store" },
    );
    return { url: result.url };
  } catch (error) {
    return failure(error);
  }
}
