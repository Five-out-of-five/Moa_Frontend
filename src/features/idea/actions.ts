"use server";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { isRoomId } from "@/features/room/management/api-server";
import { getManagedRoom } from "@/features/room/management/server";
import { listRoomMembers } from "@/features/room/server";
import { ApiError } from "@/lib/api";
import { isAuthor } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { boardSessions, conflicts, ideaCards } from "@/mocks/db";

import { ideaApi, type IdeaSchemas } from "./api-board";
import { closeExpiredIdeaSession, scheduleIdeaClose } from "./mock-board";
import { type IdeaFormResult, parseIdeaDeadline } from "./model";
import { refreshIdeaBoard } from "./server";

const cardSchema = z.object({
  type: z.enum(["AGENDA", "KEEP", "PROBLEM", "TRY"]),
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().max(1000),
});

async function mutateIdea(roomId: number, path: string, method: string, json?: unknown): Promise<IdeaFormResult> {
  try {
    await ideaApi(roomId, path, { method, json });
    return refreshIdeaBoard(roomId);
  } catch (error) {
    unstable_rethrow(error);
    const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500 &&
      error.status !== 408 && error.code !== "API_RESPONSE_INVALID";
    return {
      error: error instanceof ApiError ? error.message : "변경 사항을 저장하지 못했어요.",
      ...(path === "/idea-cards" && method === "POST" && !rejected ? { outcomeUnknown: true } : {}),
    };
  }
}

async function authorize(roomId: number) {
  if (!isMock) return null;
  const room = await getManagedRoom(roomId);
  if (room) closeExpiredIdeaSession(roomId);
  return room;
}

export async function startIdeaSession(roomId: number, _: IdeaFormResult, form: FormData): Promise<IdeaFormResult> {
  if (!isRoomId(roomId)) return { error: "이 방의 회차를 시작할 수 없어요." };
  const title = z.string().trim().min(1).max(50).safeParse(form.get("title"));
  if (!title.success) return { error: "회차 이름을 1~50자로 입력해 주세요." };
  const deadline = String(form.get("endsAt") ?? "").trim();
  const endsAt = deadline ? parseIdeaDeadline(deadline) : null;
  if (deadline && (!endsAt || Date.parse(endsAt) <= Date.now())) {
    return { error: "마감 시각을 현재보다 나중으로 설정해 주세요." };
  }
  if (!isMock) return mutateIdea(roomId, "/sessions", "POST", { title: title.data, deadlineAt: endsAt ?? undefined });
  if (!(await authorize(roomId))) return { error: "이 방의 회차를 시작할 수 없어요." };
  if (boardSessions.some((item) => item.roomId === roomId && item.state === "ACTIVE")) {
    return { error: "이미 진행 중인 회차가 있어요." };
  }
  const id = boardSessions.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const session = { id, roomId, title: title.data, state: "ACTIVE" as const, startsAt: new Date().toISOString(), endsAt };
  boardSessions.push(session);
  scheduleIdeaClose(session);
  return refreshIdeaBoard(roomId);
}

export async function closeIdeaSession(roomId: number, sessionId: number): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(sessionId)) return { error: "회차를 확인해 주세요." };
  if (!isMock) return mutateIdea(roomId, `/sessions/${sessionId}/close`, "POST");
  const context = await authorize(roomId);
  if (!context) return { error: "이 방의 회차를 마감할 수 없어요." };
  const session = boardSessions.find((item) => item.id === sessionId && item.roomId === roomId && item.state === "ACTIVE");
  if (!session) return { error: "진행 중인 회차가 아니에요." };
  session.state = "CLOSED";
  session.closedBy = context.account.id;
  session.endsAt = new Date().toISOString();
  return refreshIdeaBoard(roomId);
}

export async function saveIdeaCard(
  roomId: number, sessionId: number, cardId: number | null, _: IdeaFormResult, form: FormData,
): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(sessionId) || (cardId !== null && !isRoomId(cardId))) return { error: "카드를 확인해 주세요." };
  const parsed = cardSchema.safeParse({ type: form.get("type"), title: form.get("title"), content: form.get("content") });
  if (!parsed.success) return { error: "유형을 선택하고 제목은 1~100자, 내용은 1,000자 이내로 입력해 주세요." };
  if (!isMock) {
    const { type: cardType, title, content } = parsed.data;
    const fileIds = form.getAll("fileId").map(Number);
    if (fileIds.length > 5 || !fileIds.every(isRoomId) || new Set(fileIds).size !== fileIds.length) {
      return { error: "첨부 파일을 확인해 주세요. 최대 5개까지 추가할 수 있어요." };
    }
    if (cardId !== null) return mutateIdea(roomId, `/idea-cards/${cardId}`, "PATCH", { title, content });
    const requestId = z.string().uuid().optional().safeParse(form.get("requestId") ?? undefined);
    if (!requestId.success) return { error: "카드 저장 요청을 확인해 주세요." };
    const request: IdeaSchemas["IdeaCardCreateRequest"] = { cardType, title, content, fileIds, sessionId, requestId: requestId.data };
    return mutateIdea(roomId, "/idea-cards", "POST", request);
  }
  const context = await authorize(roomId);
  if (!context) return { error: "이 방의 카드를 저장할 수 없어요." };
  const roster = cardId === null ? await listRoomMembers(roomId) : [];
  closeExpiredIdeaSession(roomId);
  if (!boardSessions.some((item) => item.roomId === roomId && item.id === sessionId && item.state === "ACTIVE")) {
    return { error: "진행 중인 회차에서만 카드를 저장할 수 있어요." };
  }
  const { type: cardType, title, content } = parsed.data;
  const sortOrder = ideaCards.reduce((max, item) => item.sessionId === sessionId && item.cardType === cardType
    ? Math.max(max, item.sortOrder + 1) : max, 0);
  if (cardId === null) {
    const author = roster.find(({ accountId }) => accountId === context.account.id);
    if (!author) return { error: "이 방의 멤버 정보가 없어요." };
    const id = ideaCards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
    ideaCards.push({
      id, roomId, sessionId, cardType, title, content, author, sortOrder,
      commentCount: 0, reactionCount: 0, convertedTaskId: null, createdAt: new Date().toISOString(),
    });
  } else {
    const card = ideaCards.find((item) => item.roomId === roomId && item.sessionId === sessionId && item.id === cardId);
    if (!card || !isAuthor(context.account, card.author)) return { error: "본인 카드만 수정할 수 있어요." };
    Object.assign(card, { title, content, sortOrder: cardType === card.cardType ? card.sortOrder : sortOrder, cardType });
  }
  return refreshIdeaBoard(roomId);
}

export async function deleteIdeaCard(roomId: number, cardId: number): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(cardId)) return { error: "카드를 확인해 주세요." };
  if (!isMock) return mutateIdea(roomId, `/idea-cards/${cardId}`, "DELETE");
  const context = await authorize(roomId);
  if (!context) return { error: "이 방의 카드를 삭제할 수 없어요." };
  const index = ideaCards.findIndex((item) => item.roomId === roomId && item.id === cardId);
  const card = ideaCards[index];
  if (!card || !isAuthor(context.account, card.author)) return { error: "본인 카드만 삭제할 수 있어요." };
  if (!boardSessions.some((item) => item.id === card.sessionId && item.roomId === roomId && item.state === "ACTIVE")) {
    return { error: "마감된 회차의 카드는 삭제할 수 없어요." };
  }
  ideaCards.splice(index, 1);
  for (const other of ideaCards) {
    if (other.roomId === roomId && other.sourceCardIds?.includes(cardId)) {
      other.sourceCardIds = other.sourceCardIds.filter((id) => id !== cardId);
    }
  }
  for (let i = conflicts.length - 1; i >= 0; i--) {
    if (conflicts[i].roomId === roomId && (conflicts[i].leftCardId === cardId || conflicts[i].rightCardId === cardId)) conflicts.splice(i, 1);
  }
  return refreshIdeaBoard(roomId);
}
