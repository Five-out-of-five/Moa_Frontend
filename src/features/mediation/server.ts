import "server-only";

import { unstable_rethrow } from "next/navigation";

import { getIdeaRevision } from "@/features/idea/mock-board";
import { getLiveIdeaCard } from "@/features/idea/server";
import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, compromiseDrafts, conflicts, ideaCards, roomWidgets } from "@/mocks/db";
import type { components } from "@/types/api";
import type { CardConflict, IdeaCard } from "@/types/db";

import { ideaMediationHref, type MediationCard, type MediationDetail, type MediationItem, type MediationStatus } from "./model";

type Schemas = components["schemas"];
type ConflictSummary = Schemas["ConflictSummaryResponse"] & { adoptedCardId?: number | null };

function hasMediationWidget(roomId: number) {
  return roomWidgets.some((item) => item.roomId === roomId && item.widgetType === "MEDIATION");
}

export function listMockConflicts(roomId: number) {
  if (!hasMediationWidget(roomId)) return [];
  return conflicts.filter((conflict) => conflict.roomId === roomId &&
    ideaCards.some((card) => card.roomId === roomId && card.id === conflict.leftCardId) &&
    ideaCards.some((card) => card.roomId === roomId && card.id === conflict.rightCardId));
}

function mockSummary(conflict: CardConflict): MediationItem {
  const drafts = compromiseDrafts.filter((draft) => draft.conflictId === conflict.id);
  const adoptedCardId = drafts.find((draft) => draft.adoptedCardId !== null)?.adoptedCardId ?? null;
  const status = conflict.state === "DISMISSED" ? "DISMISSED"
    : drafts.length ? "PROPOSED" : conflict.redetected ? "REDETECTED" : "DETECTED";
  return { id: conflict.id, status, adoptedCardId, leftCardTitle: conflict.leftCardTitle,
    rightCardTitle: conflict.rightCardTitle, detectedAt: conflict.detectedAt };
}

function sortConflicts(items: MediationItem[]) {
  return items.sort((a, b) => (Date.parse(b.detectedAt ?? "") || 0) - (Date.parse(a.detectedAt ?? "") || 0));
}

function isMissingWidget(error: unknown) {
  return error instanceof ApiError && error.status === 409 && error.code === "MEDIATION_WIDGET_REQUIRED";
}

export async function getMediationBoard(roomId: number, status?: MediationStatus) {
  if (isMock) {
    const enabled = Boolean(await getManagedRoom(roomId)) && hasMediationWidget(roomId);
    const items = enabled ? sortConflicts(listMockConflicts(roomId).map(mockSummary)) : [];
    return { enabled, items: status ? items.filter((item) => item.status === status) : items, revision: getIdeaRevision(roomId) };
  }
  try {
    const query = status ? `?status=${status}` : "";
    const response = await api<ConflictSummary[]>(`/api/v1/rooms/${roomId}/conflicts${query}`);
    const items = response.flatMap(({ conflictId, status, cardA, cardB, detectedAt, adoptedCardId }): MediationItem[] =>
      conflictId && status ? [{ id: conflictId, status, leftCardTitle: cardA?.title ?? "제목 없음",
        rightCardTitle: cardB?.title ?? "제목 없음", detectedAt: detectedAt ?? null, adoptedCardId: adoptedCardId ?? null }] : []);
    return { enabled: true, items: sortConflicts(items), revision: null };
  } catch (error) {
    if (isMissingWidget(error)) return { enabled: false, items: [], revision: null };
    throw error;
  }
}

function mockCard(roomId: number, card?: IdeaCard): MediationCard | null {
  if (!card) return null;
  const archived = boardSessions.some((session) => session.roomId === roomId && session.id === card.sessionId && session.state === "CLOSED");
  return { title: card.title, content: card.content, author: card.author.displayName, cardType: card.cardType,
    href: ideaMediationHref(roomId, card.id, archived ? card.sessionId : undefined) };
}

function liveCard(roomId: number, card?: Schemas["IdeaCardDetailResponse"]): MediationCard | null {
  if (!card?.cardId) return null;
  return { title: card.title ?? "제목 없음", content: card.content ?? "", author: card.writer?.displayName ?? "알 수 없는 작성자", cardType: card.cardType,
    href: ideaMediationHref(roomId, card.cardId, card.sessionClosed ? card.sessionId : undefined) };
}

export async function getMediationDetail(roomId: number, conflictId: number): Promise<MediationDetail | null> {
  if (isMock) {
    const context = await getManagedRoom(roomId);
    const conflict = context && listMockConflicts(roomId).find(({ id }) => id === conflictId);
    if (!conflict) return null;
    const { status, adoptedCardId } = mockSummary(conflict);
    const findCard = (cardId: number | null) => ideaCards.find((card) => card.roomId === roomId && card.id === cardId);
    const left = mockCard(roomId, findCard(conflict.leftCardId));
    const right = mockCard(roomId, findCard(conflict.rightCardId));
    const draft = compromiseDrafts.find((item) => item.conflictId === conflictId && item.requestedBy.accountId === context.account.id && item.adoptedCardId === null);
    return { status, reason: conflict.summary, left, right, adoptedCardId, adoptedHref: mockCard(roomId, findCard(adoptedCardId))?.href ?? null,
      draft: draft ? { id: draft.id, title: "두 의견을 함께 반영한 절충안", content: draft.content,
        cardType: left?.cardType === "AGENDA" || right?.cardType === "AGENDA" ? "AGENDA" : "TRY" } : null };
  }
  try {
    const data = await api<Schemas["ConflictDetailResponse"]>(`/api/v1/rooms/${roomId}/conflicts/${conflictId}`);
    if (!data.status) return null;
    const { myDraft, adoptedCardId } = data;
    const adoptedCard = adoptedCardId ? await getLiveIdeaCard(roomId, adoptedCardId).catch((error: unknown) => {
      unstable_rethrow(error);
      return null;
    }) : null;
    return { status: data.status, reason: data.reason ?? "", left: liveCard(roomId, data.cardA), right: liveCard(roomId, data.cardB),
      adoptedCardId: adoptedCardId ?? null, adoptedHref: liveCard(roomId, adoptedCard ?? undefined)?.href ?? null,
      draft: myDraft?.draftId && myDraft.cardType && (!myDraft.status || myDraft.status === "DRAFT")
        ? { id: myDraft.draftId, title: myDraft.title ?? "", content: myDraft.content ?? "", cardType: myDraft.cardType } : null };
  } catch (error) {
    if (error instanceof ApiError && error.code === "CONFLICT_NOT_FOUND") return null;
    if (isMissingWidget(error)) return null;
    throw error;
  }
}
