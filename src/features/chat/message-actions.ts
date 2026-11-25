"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isNextControlFlowError } from "@/lib/next-redirect";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import type { ChatMessage, MessageType } from "./types";

type MessageResponse = components["schemas"]["MessageResponse"];

/**
 * 메시지 전송 입력 — `MessageComposer` 가 보낸다.
 *
 * ⚠️ `content` 와 `fileIds` 중 **하나는 필수**. BE `MessageSendRequest` 는 두 필드 모두
 *    서버 validation 상 nullable 로 선언돼 있어 둘 다 비면 "빈 메시지" 가 성공으로 떨어진다.
 *    FE 가 선제 검증으로 거절.
 * ⚠️ `clientMessageId` 는 idempotency 키. FE 가 전송 직전 crypto.randomUUID 로 발급해
 *    낙관적 추가한 로컬 메시지와 서버 응답을 매칭할 때 쓰고, 중복 전송도 BE 가 이걸로 방어.
 */
const sendMessageSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  content: z.string().trim().max(2000, "메시지는 2000자 이하로 입력해 주세요.").optional(),
  fileIds: z.array(z.number().int().positive()).optional(),
  clientMessageId: z.string().min(1, "clientMessageId 가 비어 있습니다."),
}).refine(
  (v) => (v.content && v.content.length > 0) || (v.fileIds && v.fileIds.length > 0),
  { message: "메시지 내용이나 파일 중 하나는 필요해요.", path: ["content"] },
);

const updateMessageSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  content: z.string().trim().min(1, "메시지 내용을 입력해 주세요.").max(2000, "메시지는 2000자 이하로 입력해 주세요."),
});

const messagePathSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  messageId: z.number().int().positive(),
});

const markReadSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  lastReadMessageId: z.number().int().positive(),
});

export type SendMessageResult =
  | { kind: "ok"; message: ChatMessage }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type UpdateMessageResult =
  | { kind: "ok"; message: ChatMessage }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type DeleteMessageResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

export type MarkReadResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

function revalidateChannel(roomId: number, channelId: number) {
  revalidatePath(`/rooms/${roomId}/channels/${channelId}`, "page");
  // 사이드바 unread 뱃지도 함께 refresh (layout 범위).
  revalidatePath(`/rooms/${roomId}`, "layout");
}

function mapMessage(res: MessageResponse): ChatMessage {
  return {
    id: res.messageId ?? 0,
    author: {
      accountId: res.sender?.accountId ?? 0,
      displayName: res.sender?.displayName ?? "알 수 없는 사용자",
    },
    createdAt: res.createdAt ?? new Date().toISOString(),
    content: res.deleted ? "삭제된 메시지입니다." : res.content ?? "",
    deleted: res.deleted ?? undefined,
    isSystem: res.messageType === "SYSTEM",
    edited: res.edited ?? undefined,
    clientMessageId: res.clientMessageId ?? undefined,
    messageType: (res.messageType as MessageType | undefined) ?? undefined,
  };
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

/**
 * 메시지 전송 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/messages`.
 *
 * 목 모드는 쓰기를 보존하지 않고 **입력을 그대로 ChatMessage 로 조립해** 돌려준다. WS 가
 * 아직 안 붙었으니 UI 는 이 응답을 **낙관적 추가**로 리스트에 밀어 넣는다.
 */
export async function sendMessageAction(input: unknown): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, channelId, content, fileIds, clientMessageId } = parsed.data;

  if (isMock) {
    revalidateChannel(roomId, channelId);
    return {
      kind: "ok",
      message: {
        id: Math.floor(Math.random() * 1_000_000),
        author: { accountId: 0, displayName: "나" },
        createdAt: new Date().toISOString(),
        content: content ?? "",
        clientMessageId,
        messageType: (fileIds && fileIds.length > 0 ? "FILE" : "TEXT") as MessageType,
      },
    };
  }

  try {
    const res = await api<MessageResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}/messages`,
      { method: "POST", json: { content, fileIds, clientMessageId } },
    );
    revalidateChannel(roomId, channelId);
    return { kind: "ok", message: mapMessage(res) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "메시지 전송에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 메시지 수정 — 명세 `PATCH /api/v1/rooms/{roomId}/channels/{channelId}/messages/{id}`. */
export async function updateMessageAction(input: unknown): Promise<UpdateMessageResult> {
  const parsed = updateMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, channelId, messageId, content } = parsed.data;

  if (isMock) {
    revalidateChannel(roomId, channelId);
    return {
      kind: "ok",
      message: {
        id: messageId,
        author: { accountId: 0, displayName: "나" },
        createdAt: new Date().toISOString(),
        content,
        edited: true,
      },
    };
  }

  try {
    const res = await api<MessageResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}/messages/${messageId}`,
      { method: "PATCH", json: { content } },
    );
    revalidateChannel(roomId, channelId);
    return { kind: "ok", message: mapMessage(res) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "메시지 수정에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 메시지 삭제 — 명세 `DELETE /api/v1/rooms/{roomId}/channels/{channelId}/messages/{id}`. 소프트 삭제. */
export async function deleteMessageAction(input: unknown): Promise<DeleteMessageResult> {
  const parsed = messagePathSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId, messageId } = parsed.data;

  if (isMock) {
    revalidateChannel(roomId, channelId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/channels/${channelId}/messages/${messageId}`,
      { method: "DELETE" },
    );
    revalidateChannel(roomId, channelId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "메시지 삭제에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 읽음 처리 — 명세 `PUT /api/v1/rooms/{roomId}/channels/{channelId}/read`.
 *
 * ⚠️ 메서드가 PUT (PATCH 아님). lastReadMessageId 는 사용자가 마지막으로 **본** 메시지 id.
 *    일반적으로 화면에 가장 마지막으로 노출된 메시지로 설정한다.
 */
export async function markReadAction(input: unknown): Promise<MarkReadResult> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId, lastReadMessageId } = parsed.data;

  if (isMock) {
    revalidateChannel(roomId, channelId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/channels/${channelId}/read`,
      { method: "PUT", json: { lastReadMessageId } },
    );
    revalidateChannel(roomId, channelId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "읽음 처리에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
