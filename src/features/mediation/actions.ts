"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { closeExpiredIdeaSession, markIdeaChanged } from "@/features/idea/mock-board";
import { getManagedRoom } from "@/features/room/management/server";
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
  markIdeaChanged(roomId);
  revalidatePath(`/rooms/${roomId}/mediation`);
  revalidatePath(`/rooms/${roomId}/boards/idea`);
  revalidatePath(`/rooms/${roomId}`);
  return { saved: true };
}

export async function dismissConflict(roomId: number, conflictId: number): Promise<MediationResult> {
  const context = await getContext(roomId, conflictId);
  if (!context || context.conflict.state !== "OPEN") return { error: "해제할 수 있는 충돌이 아니에요." };
  context.conflict.state = "DISMISSED";
  for (let i = compromiseDrafts.length - 1; i >= 0; i--) {
    if (compromiseDrafts[i].conflictId === conflictId && compromiseDrafts[i].adoptedCardId === null) compromiseDrafts.splice(i, 1);
  }
  return refresh(roomId);
}

export async function generateCompromise(roomId: number, conflictId: number): Promise<MediationResult> {
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
  const context = await getContext(roomId, conflictId);
  if (!context || context.conflict.state !== "OPEN") return { error: "폐기할 수 없는 초안이에요." };
  const index = compromiseDrafts.findIndex((draft) => draft.id === draftId && draft.conflictId === conflictId &&
    draft.requestedBy.accountId === context.account.id && draft.adoptedCardId === null);
  if (index < 0) return { error: "본인의 초안만 폐기할 수 있어요." };
  compromiseDrafts.splice(index, 1);
  return refresh(roomId);
}

export async function adoptCompromise(roomId: number, conflictId: number, draftId: number, _: MediationResult, form: FormData): Promise<MediationResult> {
  const context = await getContext(roomId, conflictId);
  if (!context || context.conflict.state !== "OPEN") return { error: "이미 처리됐거나 접근할 수 없는 충돌이에요." };
  const parsed = z.object({ title: z.string().trim().min(1).max(100), content: z.string().trim().min(1).max(1000) })
    .safeParse({ title: form.get("title"), content: form.get("content") });
  if (!parsed.success) return { error: "제목은 1~100자, 내용은 1~1,000자로 입력해 주세요." };
  const draft = compromiseDrafts.find((item) => item.id === draftId && item.conflictId === conflictId &&
    item.requestedBy.accountId === context.account.id && item.adoptedCardId === null);
  if (!draft) return { error: "채택할 수 있는 본인의 초안이 없어요." };
  closeExpiredIdeaSession(roomId);
  const session = boardSessions.find((item) => item.roomId === roomId && item.state === "ACTIVE");
  if (!session) return { error: "진행 중인 회차가 없어요. 아이디어 보드에서 회차를 시작해 주세요." };
  const cardType = context.left.cardType === "AGENDA" && context.right.cardType === "AGENDA" ? "AGENDA" : "TRY";
  const id = ideaCards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
  ideaCards.push({
    id, roomId, sessionId: session.id, cardType, ...parsed.data, author: draft.requestedBy,
    sortOrder: ideaCards.filter((card) => card.sessionId === session.id && card.cardType === cardType).length,
    commentCount: 0, reactionCount: 0, convertedTaskId: null, createdAt: new Date().toISOString(),
    aiSuggested: true, sourceCardIds: [context.left.id, context.right.id],
  });
  draft.content = parsed.data.content;
  draft.adoptedCardId = id;
  context.conflict.state = "RESOLVED";
  return refresh(roomId);
}
