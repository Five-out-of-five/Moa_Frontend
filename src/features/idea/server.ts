import "server-only";

import { revalidatePath } from "next/cache";
import { cache } from "react";

import { ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards, votes } from "@/mocks/db";
import type { components } from "@/types/api";
import type { IdeaCard, MemberRef } from "@/types/db";

import { ideaApi, readIdeaBoard } from "./api-board";
import { closeExpiredIdeaSession, getIdeaRevision, markIdeaChanged } from "./mock-board";
import { readMockDiscussion } from "./mock-discussion";
import type { IdeaDiscussion } from "./model";

export function refreshIdeaBoard(roomId: number) {
  if (isMock) markIdeaChanged(roomId);
  revalidatePath(`/rooms/${roomId}/boards/idea`);
  revalidatePath(`/rooms/${roomId}`);
  return { saved: true };
}

export async function getIdeaBoard(roomId: number, sessionId?: number, page?: number) {
  if (!isMock)
    return { ...(await readIdeaBoard(roomId, sessionId, page)), editable: true, usesMockStream: false, revision: 0 };
  closeExpiredIdeaSession(roomId);
  const sessions = boardSessions.filter((item) => item.roomId === roomId);
  const active = sessions.find(({ state }) => state === "ACTIVE") ?? null;
  const history = sessions
    .filter(({ state }) => state === "CLOSED")
    .sort((a, b) => (b.endsAt ?? b.startsAt).localeCompare(a.endsAt ?? a.startsAt));
  const cards = ideaCards.filter((card) => card.roomId === roomId).map((card) => {
    const vote = card.linkedVote && votes.find(({ voteId, roomId: room }) => voteId === card.linkedVote?.id && room === roomId);
    return vote ? { ...card, linkedVote: { id: vote.voteId, status: vote.status } } : card;
  });
  return { active, selected: sessionId === undefined ? active : history.find(({ id }) => id === sessionId), history, cards, editable: true, usesMockStream: true, hasNextHistory: false, revision: getIdeaRevision(roomId) };
}

type Schemas = components["schemas"];

export const getLiveIdeaCard = cache(async (roomId: number, cardId: number) => {
  try {
    return await ideaApi<Schemas["IdeaCardDetailResponse"]>(roomId, `/idea-cards/${cardId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function getLiveIdeaBriefingTarget(roomId: number, cardId: number) {
  const card = await getLiveIdeaCard(roomId, cardId);
  if (!card) return null;
  const query = card.sessionClosed && card.sessionId ? `?session=${card.sessionId}` : "";
  return { href: `/rooms/${roomId}/boards/idea${query}`, focus: cardId };
}

export function getMockIdeaSnapshot(roomId: number) {
  closeExpiredIdeaSession(roomId);
  return getIdeaRevision(roomId);
}

export function getIdeaDiscussions(
  cards: IdeaCard[],
  members: MemberRef[],
): Record<number, IdeaDiscussion> {
  if (!isMock) return {};
  const comments = [
    "다음 회의에서 한 번 제안해 보면 좋겠어요.",
    "이 방향에 동의해요. 작은 범위부터 적용해 봐요.",
    "팀이 기준을 함께 정하면 더 쉽게 진행할 수 있을 것 같아요.",
    "다음 회차에서 결과도 공유해 주세요.",
  ];
  const emoji = ["THUMBS_UP", "CLAP", "THINKING"];
  const originals = new Map(ideaCards.map((card) => [card.id, card]));
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      readMockDiscussion(originals.get(card.id) ?? card, () => ({
        comments: comments.slice(0, card.commentCount).map((text, index) => {
          const author = members[(card.id + index) % members.length] ?? card.author;
          return { id: card.id * 10 + index + 1, text, author: author.displayName, authorId: author.accountId };
        }),
        reactions: emoji
          .map((value, index) => ({
            emoji: value,
            count:
              Math.floor(card.reactionCount / emoji.length) +
              Number(index < card.reactionCount % emoji.length),
          }))
          .filter(({ count }) => count > 0),
      })),
    ]),
  );
}
