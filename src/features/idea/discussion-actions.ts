"use server";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { isRoomId } from "@/features/room/management/api-server";
import { getManagedRoom } from "@/features/room/management/server";
import { listRoomMembers } from "@/features/room/server";
import { getActiveSprint } from "@/features/task/server";
import { ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";

import { ideaApi, type IdeaSchemas } from "./api-board";
import { closeExpiredIdeaSession } from "./mock-board";
import { type MockDiscussionChange, updateMockDiscussion } from "./mock-discussion";
import { IDEA_REACTIONS, type IdeaFormResult } from "./model";
import { getIdeaDiscussions, getLiveIdeaCard, refreshIdeaBoard } from "./server";

function readError(error: unknown) {
  unstable_rethrow(error);
  return error instanceof ApiError ? error.message : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
}

function cardPath(cardId: number) {
  return `/idea-cards/${cardId}`;
}

export async function loadIdeaTaskOptions(roomId: number) {
  if (!isRoomId(roomId)) return { error: "워크스페이스를 확인해 주세요." };
  try {
    const room = await getFirstRoomProfile(String(roomId));
    if (!room?.setup || room.setup.needsSetup) return { error: "이 방에 접근할 수 없어요." };
    const [members, activeSprint] = await Promise.all([listRoomMembers(roomId), getActiveSprint(roomId)]);
    return { members, activeSprint };
  } catch (error) {
    return { error: readError(error) };
  }
}

export async function loadIdeaCardDetail(roomId: number, cardId: number) {
  if (!isRoomId(roomId) || !isRoomId(cardId)) return { error: "카드를 확인해 주세요." };
  try {
    if (isMock) {
      if (!(await getManagedRoom(roomId))) return { error: "이 방의 카드를 열 수 없어요." };
      closeExpiredIdeaSession(roomId);
      const card = ideaCards.find(({ id, roomId: room }) => id === cardId && room === roomId);
      if (!card) return { error: "카드를 찾을 수 없어요." };
      const roster = await listRoomMembers(roomId);
      return {
        closed: !boardSessions.some((session) => session.id === card.sessionId && session.state === "ACTIVE"),
        discussion: getIdeaDiscussions([card], roster)[cardId],
      };
    }
    const [card, comments] = await Promise.all([
      getLiveIdeaCard(roomId, cardId),
      ideaApi<IdeaSchemas["CommentResponse"][]>(roomId, `${cardPath(cardId)}/comments`),
    ]);
    if (!card) return { error: "카드를 찾을 수 없어요." };
    return {
      card,
      closed: card.sessionClosed === true,
      discussion: {
        comments: comments.flatMap((row) => row.commentId == null ? [] : [{
          id: row.commentId, authorId: row.writer?.accountId ?? 0,
          author: row.writer?.displayName ?? "알 수 없는 사용자",
          text: row.deleted ? "삭제된 댓글입니다." : row.content ?? "",
          deleted: row.deleted, edited: row.edited,
        }]),
        reactions: (card.reactions ?? []).flatMap((item) => item.emoji ? [{
          emoji: item.emoji, count: item.count ?? 0, users: item.users ?? [],
        }] : []),
      },
    };
  } catch (error) {
    return { error: readError(error) };
  }
}

async function changeCard(roomId: number, cardId: number, path: string, method: string, json?: unknown): Promise<IdeaFormResult> {
  try {
    await ideaApi(roomId, `${cardPath(cardId)}${path}`, { method, json });
    return refreshIdeaBoard(roomId);
  } catch (error) {
    return { error: readError(error) };
  }
}

export async function setIdeaReaction(roomId: number, cardId: number, emoji: string, selected: boolean): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(cardId) || !Object.hasOwn(IDEA_REACTIONS, emoji) || typeof selected !== "boolean") {
    return { error: "리액션을 확인해 주세요." };
  }
  if (isMock) return changeMockDiscussion(roomId, cardId, { emoji, selected });
  return changeCard(roomId, cardId, `/reactions/${emoji}`, selected ? "PUT" : "DELETE");
}

export async function changeIdeaComment(roomId: number, cardId: number, operation: "add" | "edit" | "remove", commentId: number | null, input: unknown): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(cardId) || !["add", "edit", "remove"].includes(operation) ||
    (operation !== "add" && (commentId === null || !isRoomId(commentId)))) return { error: "댓글을 확인해 주세요." };
  const parsed = z.string().trim().min(1).max(500).safeParse(input);
  if (operation !== "remove" && !parsed.success) return { error: "댓글은 1~500자로 입력해 주세요." };
  const content = parsed.data ?? "";
  if (isMock) return changeMockDiscussion(roomId, cardId, { operation, commentId, content });
  return changeCard(roomId, cardId, operation === "add" ? "/comments" : `/comments/${commentId}`,
    operation === "add" ? "POST" : operation === "edit" ? "PATCH" : "DELETE",
    operation === "remove" ? undefined : { content });
}

export async function setIdeaEditLock(roomId: number, cardId: number, locked: boolean): Promise<IdeaFormResult> {
  if (!isRoomId(roomId) || !isRoomId(cardId) || typeof locked !== "boolean") return { error: "카드를 확인해 주세요." };
  if (isMock) return { saved: true };
  try {
    await ideaApi(roomId, `${cardPath(cardId)}/edit-lock`, { method: locked ? "POST" : "DELETE" });
    return { saved: true };
  } catch (error) {
    return { error: readError(error) };
  }
}

async function changeMockDiscussion(roomId: number, cardId: number, change: MockDiscussionChange): Promise<IdeaFormResult> {
  const context = await getManagedRoom(roomId);
  if (!context) return { error: "이 방의 카드를 수정할 수 없어요." };
  closeExpiredIdeaSession(roomId);
  const card = ideaCards.find(({ id, roomId: room }) => id === cardId && room === roomId);
  if (!card || !boardSessions.some((session) => session.id === card.sessionId && session.state === "ACTIVE")) {
    return { error: "진행 중인 회차의 카드만 변경할 수 있어요." };
  }
  const discussion = getIdeaDiscussions([card], await listRoomMembers(roomId))[cardId];
  const result = updateMockDiscussion(card, discussion, context.account, change);
  if (result.saved) refreshIdeaBoard(roomId);
  return result;
}
