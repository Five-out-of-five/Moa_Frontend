import "server-only";

import { api, ApiError } from "@/lib/api";
import type { components } from "@/types/api";
import type { BoardSession, IdeaCard } from "@/types/db";

export type IdeaSchemas = components["schemas"];
export function ideaApi<T>(roomId: number, path: string, init?: Parameters<typeof api>[1]) {
  return api<T>(`/api/v1/rooms/${roomId}${path}`, { ...init, cache: "no-store" });
}

function toSession(roomId: number, item: IdeaSchemas["SessionResponse"], closed?: boolean) {
  if (!item.sessionId) return null;
  return {
    id: item.sessionId, roomId, title: item.title ?? "회차",
    state: closed || item.status === "CLOSED" ? "CLOSED" : "ACTIVE",
    startsAt: item.startedAt ?? item.closedAt ?? "",
    endsAt: item.closedAt ?? item.deadlineAt ?? null,
    cardCount: item.cardCount, participantCount: item.participantCount,
  } satisfies BoardSession;
}

export async function readIdeaBoard(roomId: number, requestedId?: number, page?: number) {
  const [current, requested, history] = await Promise.all([
    ideaApi<IdeaSchemas["SessionResponse"] | null>(roomId, "/sessions/current"),
    requestedId === undefined ? null : ideaApi<IdeaSchemas["SessionResponse"]>(roomId, `/sessions/${requestedId}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.code === "SESSION_NOT_FOUND") return null;
      throw error;
    }),
    page === undefined ? null : ideaApi<IdeaSchemas["PageResponseSessionSummaryResponse"]>(roomId, `/sessions?page=${page}&size=20`),
  ]);
  const active = current && toSession(roomId, current);
  const selected = requestedId === undefined ? active : requested?.status === "CLOSED" ? toSession(roomId, requested) : null;
  const entries = selected
    ? await ideaApi<(IdeaSchemas["IdeaCardSummaryResponse"] & { content?: string | null })[]>(
        roomId, requestedId === undefined ? "/idea-cards" : `/idea-cards?sessionId=${selected.id}`,
      )
    : [];
  const cards: IdeaCard[] = [];
  if (selected) {
    for (const item of entries) {
      if (!item.cardId || !item.cardType || !item.createdAt) continue;
      cards.push({
        id: item.cardId, roomId, sessionId: selected.id, cardType: item.cardType,
        title: item.title ?? "", content: item.content ?? "", createdAt: item.createdAt,
        sortOrder: item.sortOrder ?? 0, commentCount: item.commentCount ?? 0,
        convertedTaskId: item.convertedTask?.taskId ?? null,
        linkedVote: item.linkedVote?.voteId && item.linkedVote.status
          ? { id: item.linkedVote.voteId, status: item.linkedVote.status } : undefined,
        conflictCount: item.conflictCount, fileCount: item.fileCount,
        aiSuggested: item.isAiGenerated, version: item.version,
        reactionCount: item.reactions?.reduce((sum, reaction) => sum + (reaction.count ?? 0), 0) ?? 0,
        reactions: item.reactions,
        author: {
          accountId: item.writer?.accountId ?? 0,
          displayName: item.writer?.displayName ?? "알 수 없는 사용자",
          profileImageUrl: item.writer?.profileImageUrl ?? null,
          memberStatus: item.writer?.memberStatus ?? "LEFT",
        },
      });
    }
  }
  return {
    active, selected, cards,
    history: (history?.content ?? []).flatMap((entry) => {
      const session = toSession(roomId, entry, true);
      return session ? [session] : [];
    }),
    hasNextHistory: history?.hasNext ?? false,
  };
}
