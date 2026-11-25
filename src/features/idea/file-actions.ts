"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { isRoomId } from "@/features/room/management/api-server";
import { discardRoomFileUpload, uploadRoomFile } from "@/features/room-files/upload-server";
import { ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";

import { ideaApi } from "./api-board";

function failure(error: unknown) {
  unstable_rethrow(error);
  return { error: error instanceof ApiError ? error.message : "첨부 파일을 변경하지 못했어요." };
}

export async function stageIdeaFile(roomId: number, data: FormData) {
  const file = data.get("file");
  if (isMock || !isRoomId(roomId) || !(file instanceof File)) return { error: "첨부 파일을 확인해 주세요." };
  try {
    return { fileId: (await uploadRoomFile(roomId, "CARD_ATTACHMENT", file)).fileId };
  } catch (error) {
    return failure(error);
  }
}

export async function discardIdeaFile(roomId: number, fileId: number) {
  if (isMock || !isRoomId(roomId) || !isRoomId(fileId)) return;
  try { await discardRoomFileUpload(roomId, fileId); } catch (error) { unstable_rethrow(error); }
}

export async function attachIdeaFile(roomId: number, cardId: number, data: FormData) {
  if (!isRoomId(cardId)) return { error: "카드를 확인해 주세요." };
  const upload = await stageIdeaFile(roomId, data);
  if (!upload.fileId) return { error: upload.error };
  try {
    await ideaApi(roomId, `/idea-cards/${cardId}/files`, { method: "POST", json: { fileId: upload.fileId } });
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    revalidatePath(`/rooms/${roomId}/files`);
    return { saved: true };
  } catch (error) {
    await discardIdeaFile(roomId, upload.fileId);
    return failure(error);
  }
}

export async function removeIdeaFile(roomId: number, cardId: number, fileId: number) {
  if (isMock || !isRoomId(roomId) || !isRoomId(cardId) || !isRoomId(fileId)) return { error: "첨부 파일을 확인해 주세요." };
  try {
    await ideaApi(roomId, `/idea-cards/${cardId}/files/${fileId}`, { method: "DELETE" });
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    revalidatePath(`/rooms/${roomId}/files`);
    return { saved: true };
  } catch (error) {
    return failure(error);
  }
}
