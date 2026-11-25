"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { closeExpiredIdeaSession, markIdeaChanged } from "@/features/idea/mock-board";
import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, compromiseDrafts, conflicts, ideaCards, roomWidgets } from "@/mocks/db";

import type { MediationResult } from "./model";

async function getContext(roomId: number, conflictId: number) {
  if (!isMock || !roomWidgets.some((widget) => widget.roomId === roomId && widget.widgetType === "MEDIATION")) return null;
  const room = await getManagedRoom(roomId);
  const conflict = conflicts.find((item) => item.roomId === roomId && item.id === conflictId);
  if (!room || !conflict) return null;
  const left = ideaCards.find((card) => card.roomId === roomId && card.id === conflict.leftCardId);
  const right = ideaCards.find((card) => card.roomId === roomId && card.id === conflict.rightCardId);
  return left && right ? { ...room, conflict, left, right } : null;
}

function refresh(roomId: number): MediationResult {
  if (isMock) markIdeaChanged(roomId);
  revalidatePath(`/rooms/${roomId}/mediation`);
  revalidatePath(`/rooms/${roomId}/boards/idea`);
  revalidatePath(`/rooms/${roomId}`);
  return { saved: true };
}

function validIds(...ids: number[]) {
  return ids.every((id) => Number.isSafeInteger(id) && id > 0);
}

async function postConflict(roomId: number, conflictId: number, path: string, options?: { json?: unknown; timeoutMs?: number }): Promise<MediationResult> {
  try {
    await api(`/api/v1/rooms/${roomId}/conflicts/${conflictId}/${path}`, { method: "POST", ...options });
    return refresh(roomId);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : "요청을 처리하지 못했어요. 다시 시도해 주세요." };
  }
}

export async function dismissConflict(roomId: number, conflictId: number): Promise<MediationResult> {
  if (!validIds(roomId, conflictId)) return { error: "해제할 수 있는 충돌이 아니에요." };
  if (!isMock) return postConflict(roomId, conflictId, "dismiss");
  const context = await getContext(roomId, conflictId);
  if (!context || context.conflict.state === "DISMISSED") return { error: "해제할 수 있는 충돌이 아니에요." };
  context.conflict.state = "DISMISSED";
  return refresh(roomId);
}

export async function generateCompromise(roomId: number, conflictId: number): Promise<MediationResult> {
  if (!validIds(roomId, conflictId)) return { error: "절충안을 만들 수 있는 충돌이 아니에요." };
  if (!isMock) return postConflict(roomId, conflictId, "compromise-drafts", { timeoutMs: 35_000 });
  const context = await getContext(roomId, conflictId);
  if (!context || context.conflict.state !== "OPEN") return { error: "절충안을 만들 수 있는 충돌이 아니에요." };
  if (compromiseDrafts.some((draft) => draft.conflictId === conflictId && draft.requestedBy.accountId === context.account.id && draft.adoptedCardId === null)) return { saved: true };
  compromiseDrafts.push({
    id: compromiseDrafts.reduce((max, draft) => Math.max(max, draft.id), 0) + 1,
    conflictId, requestedBy: { accountId: context.account.id, displayName: context.membership.nickname ?? context.account.name, profileImageUrl: null, memberStatus: "ACTIVE" },
    content: `‘${context.left.title}’와 ‘${context.right.title}’의 목적을 함께 고려해요. 우선 작은 범위에서 두 방식을 나누어 적용하고, 다음 회고에서 결과를 비교해 팀의 기준을 정해요.`,
    adoptedCardId: null, createdAt: new Date().toISOString(),
  });
  return refresh(roomId);
}

export async function discardCompromise(roomId: number, conflictId: number, draftId: number): Promise<MediationResult> {
  if (!validIds(roomId, conflictId, draftId)) return { error: "폐기할 수 없는 초안이에요." };
  if (!isMock) return postConflict(roomId, conflictId, `compromise-drafts/${draftId}/discard`);
  const context = await getContext(roomId, conflictId);
  if (!context) return { error: "폐기할 수 없는 초안이에요." };
  const index = compromiseDrafts.findIndex((draft) => draft.id === draftId && draft.conflictId === conflictId &&
    draft.requestedBy.accountId === context.account.id && draft.adoptedCardId === null);
  if (index < 0) return { error: "본인의 초안만 폐기할 수 있어요." };
  compromiseDrafts.splice(index, 1);
  if (context.conflict.state === "OPEN") context.conflict.redetected = true;
  return refresh(roomId);
}

export async function adoptCompromise(roomId: number, conflictId: number, draftId: number, _: MediationResult, form: FormData): Promise<MediationResult> {
  if (!validIds(roomId, conflictId, draftId)) return { error: "채택할 수 있는 초안이 아니에요." };
  const parsed = z.object({ title: z.string().trim().min(1).max(100), content: z.string().trim().max(1000) })
    .safeParse({ title: form.get("title"), content: form.get("content") ?? "" });
  if (!parsed.success) return { error: "제목은 1~100자, 내용은 최대 1,000자로 입력해 주세요." };
  if (!isMock) return postConflict(roomId, conflictId, `compromise-drafts/${draftId}/adopt`, { json: parsed.data });
  const context = await getContext(roomId, conflictId);
  if (!context || compromiseDrafts.some((item) => item.conflictId === conflictId && item.adoptedCardId !== null)) {
    return { error: "이미 처리됐거나 접근할 수 없는 충돌이에요." };
  }
  if (!conflicts.includes(context.conflict) || !ideaCards.includes(context.left) || !ideaCards.includes(context.right)) {
    return { error: "원본 카드나 충돌이 삭제되어 절충안을 채택할 수 없어요." };
  }
  const draft = compromiseDrafts.find((item) => item.id === draftId && item.conflictId === conflictId &&
    item.requestedBy.accountId === context.account.id && item.adoptedCardId === null);
  if (!draft) return { error: "채택할 수 있는 본인의 초안이 없어요." };
  closeExpiredIdeaSession(roomId);
  const session = boardSessions.find((item) => item.roomId === roomId && item.state === "ACTIVE");
  if (!session) return { error: "진행 중인 회차가 없어요. 아이디어 보드에서 회차를 시작해 주세요." };
  const cardType = context.left.cardType === "AGENDA" || context.right.cardType === "AGENDA" ? "AGENDA" : "TRY";
  const id = ideaCards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
  ideaCards.push({
    id, roomId, sessionId: session.id, cardType, ...parsed.data, author: draft.requestedBy,
    sortOrder: ideaCards.filter((card) => card.sessionId === session.id && card.cardType === cardType).length,
    commentCount: 0, reactionCount: 0, convertedTaskId: null, createdAt: new Date().toISOString(),
    aiSuggested: true, sourceCardIds: [context.left.id, context.right.id],
  });
  draft.content = parsed.data.content;
  draft.adoptedCardId = id;
  if (context.conflict.state !== "DISMISSED") context.conflict.state = "RESOLVED";
  return refresh(roomId);
}
