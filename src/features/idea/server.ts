import "server-only";

import { cache } from "react";

import { api, ApiError } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";
import type { components } from "@/types/api";
import type { BoardSession, IdeaCard, MemberRef } from "@/types/db";

import { closeExpiredIdeaSession, getIdeaRevision } from "./mock-board";
import type { IdeaDiscussion } from "./model";

export async function getIdeaBoard(roomId: number, sessionId?: number) {
  if (!isMock)
    return { ...(await getLiveIdeaBoard(roomId, sessionId)), editable: false, revision: 0 };
  closeExpiredIdeaSession(roomId);
  const sessions = boardSessions.filter((item) => item.roomId === roomId);
  const active = sessions.find(({ state }) => state === "ACTIVE") ?? null;
  const history = sessions
    .filter(({ state }) => state === "CLOSED")
    .sort((a, b) => (b.endsAt ?? b.startsAt).localeCompare(a.endsAt ?? a.startsAt));
  const cards = ideaCards.filter((card) => card.roomId === roomId);
  return { active, history, cards, editable: true, revision: getIdeaRevision(roomId) };
}

type Schemas = components["schemas"];

const getLiveIdeaCard = cache(async (roomId: number, cardId: number) => {
  const { init, query } = await getApiAccountContext();
  try {
    return await api<Schemas["IdeaCardDetailResponse"]>(
      `/api/v1/rooms/${roomId}/idea-cards/${cardId}?${query}`,
      init,
    );
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

async function getLiveIdeaBoard(roomId: number, requestedSessionId?: number) {
  const { init, query } = await getApiAccountContext();
  const root = `/api/v1/rooms/${roomId}`;
  const empty = { active: null, history: [], cards: [] };
  const sessionPath = requestedSessionId ?? "current";
  const session = await api<Schemas["SessionResponse"] | null>(
    `${root}/sessions/${sessionPath}?${query}`,
    init,
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  const expectedStatus = requestedSessionId === undefined ? "IN_PROGRESS" : "CLOSED";
  if (!session?.sessionId || session.status !== expectedStatus || !session.startedAt) return empty;
  const sessionId = session.sessionId;
  const entries = await api<Schemas["IdeaCardSummaryResponse"][]>(
    `${root}/idea-cards?${query}&sessionId=${sessionId}`,
    init,
  );
  const details = await Promise.all(
    entries.flatMap(({ cardId }) => (cardId ? [getLiveIdeaCard(roomId, cardId)] : [])),
  );
  const cards: IdeaCard[] = details.flatMap((item) => {
    if (!item?.cardId || !item.cardType || !item.createdAt || item.sessionId !== sessionId)
      return [];
    return [
      {
        id: item.cardId,
        roomId,
        sessionId,
        cardType: item.cardType,
        title: item.title ?? "",
        content: item.content ?? "",
        createdAt: item.createdAt,
        sortOrder: item.sortOrder ?? 0,
        commentCount: item.commentCount ?? 0,
        convertedTaskId: item.convertedTask?.taskId ?? null,
        reactionCount:
          item.reactions?.reduce((sum, reaction) => sum + (reaction.count ?? 0), 0) ?? 0,
        author: {
          accountId: item.writer?.accountId ?? 0,
          displayName: item.writer?.displayName ?? "알 수 없는 사용자",
          profileImageUrl: item.writer?.profileImageUrl ?? null,
          memberStatus: item.writer?.memberStatus ?? "LEFT",
        },
      },
    ];
  });
  const selected: BoardSession = {
    id: sessionId,
    roomId,
    title: session.title ?? "회차",
    state: session.status === "CLOSED" ? "CLOSED" : "ACTIVE",
    startsAt: session.startedAt,
    endsAt: session.closedAt ?? session.deadlineAt ?? null,
  };
  return selected.state === "CLOSED"
    ? { active: null, history: [selected], cards }
    : { active: selected, history: [], cards };
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
  const emoji = ["👍", "👏", "💡"];
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        comments: comments.slice(0, card.commentCount).map((text, index) => {
          const author = members[(card.id + index) % members.length] ?? card.author;
          return { text, author: author.displayName, authorId: author.accountId };
        }),
        reactions: emoji
          .map((value, index) => ({
            emoji: value,
            count:
              Math.floor(card.reactionCount / emoji.length) +
              Number(index < card.reactionCount % emoji.length),
          }))
          .filter(({ count }) => count > 0),
      },
    ]),
  );
}
