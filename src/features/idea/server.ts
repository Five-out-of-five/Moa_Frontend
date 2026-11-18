import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";
import type { BoardSession, IdeaCard, MemberRef } from "@/types/db";

import { closeExpiredIdeaSession, getIdeaRevision } from "./mock-board";
import type { IdeaDiscussion } from "./model";

/** 방의 진행 중 회차. 없으면 null (이 경우 카드 등록 불가 - 명세 §board_session) */
export async function getActiveSession(
  roomId: number,
): Promise<BoardSession | null> {
  if (isMock) {
    closeExpiredIdeaSession(roomId);
    return boardSessions.find((s) => s.roomId === roomId && s.state === "ACTIVE") ?? null;
  }
  return api<BoardSession | null>(`/api/v1/rooms/${roomId}/idea-sessions/active`);
}

export async function getIdeaBoard(roomId: number) {
  const [active, cards] = await Promise.all([getActiveSession(roomId), listIdeaCards(roomId)]);
  const history = isMock
    ? boardSessions.filter((item) => item.roomId === roomId && item.state === "CLOSED")
      .sort((a, b) => (b.endsAt ?? b.startsAt).localeCompare(a.endsAt ?? a.startsAt))
    : [];
  return { active, history, cards, editable: isMock, revision: isMock ? getIdeaRevision(roomId) : 0 };
}

export function getMockIdeaSnapshot(roomId: number) {
  closeExpiredIdeaSession(roomId);
  return getIdeaRevision(roomId);
}

export function getIdeaDiscussions(cards: IdeaCard[], members: MemberRef[]): Record<number, IdeaDiscussion> {
  if (!isMock) return {};
  const comments = [
    "다음 회의에서 한 번 제안해 보면 좋겠어요.",
    "이 방향에 동의해요. 작은 범위부터 적용해 봐요.",
    "팀이 기준을 함께 정하면 더 쉽게 진행할 수 있을 것 같아요.",
    "다음 회차에서 결과도 공유해 주세요.",
  ];
  const emoji = ["👍", "👏", "💡"];
  return Object.fromEntries(cards.map((card) => [card.id, {
    comments: comments.slice(0, card.commentCount).map((text, index) => {
      const author = members[(card.id + index) % members.length] ?? card.author;
      return { text, author: author.displayName, authorId: author.accountId };
    }),
    reactions: emoji.map((value, index) => ({
      emoji: value, count: Math.floor(card.reactionCount / emoji.length) + Number(index < card.reactionCount % emoji.length),
    })).filter(({ count }) => count > 0),
  }]));
}

/** 진행 중 회차의 카드 목록 — AGENDA/KEEP/PROBLEM/TRY 별로 분리해 소비한다. */
export async function listIdeaCards(roomId: number): Promise<IdeaCard[]> {
  if (isMock) return ideaCards.filter((c) => c.roomId === roomId);
  return api<IdeaCard[]>(`/api/v1/rooms/${roomId}/idea-cards`);
}
