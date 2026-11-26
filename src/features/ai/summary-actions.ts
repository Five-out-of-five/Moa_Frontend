"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { closeExpiredIdeaSession, markIdeaChanged } from "@/features/idea/mock-board";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";
import type { components } from "@/types/api";
import type { IdeaCardType } from "@/types/db";

import { aiFailure } from "./action-error";
import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext, toMeetingSummary } from "./server";
import type { AiResult, MeetingSummary } from "./types";

type Schemas = components["schemas"];
const cardData = z.object({ cardType: z.enum(["AGENDA", "KEEP", "PROBLEM", "TRY"]), title: z.string().trim().min(1).max(100) });

function summaryPath(roomId: number, summaryId?: string) {
  if (!Number.isSafeInteger(roomId) || roomId < 1 || (summaryId !== undefined && !/^[a-f0-9-]{1,64}$/i.test(summaryId))) {
    throw new Error("회의 요약 정보를 확인해 주세요.");
  }
  return `/api/v1/rooms/${roomId}/ai/summaries${summaryId === undefined ? "" : `/${summaryId}`}`;
}

function revalidateBoard(roomId: number) {
  revalidatePath(`/rooms/${roomId}/boards/idea`);
}

export async function summarizeMeeting(roomId: number, sessionIds: number[]): Promise<AiResult<MeetingSummary>> {
  try {
    const path = summaryPath(roomId);
    if (!Array.isArray(sessionIds) || sessionIds.length > 100 || sessionIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      throw new Error("요약할 회차를 선택해 주세요.");
    }
    let summary: MeetingSummary;
    if (!isMock) {
      const json = sessionIds.length ? { scopeType: "SESSIONS", sessionIds } : { scopeType: "ALL" };
      summary = toMeetingSummary(await api<Schemas["SummaryResponse"]>(path, { method: "POST", json, timeoutMs: 35_000 }));
    } else {
      const { account } = await getAiContext(roomId);
      closeExpiredIdeaSession(roomId);
      const sessions = boardSessions.filter((session) => session.roomId === roomId && session.state === "CLOSED" && sessionIds.includes(session.id));
      if (sessionIds.some((id) => !sessions.some((session) => session.id === id))) throw new Error("선택 요약은 마감된 회차만 사용할 수 있어요.");
      const cards = ideaCards.filter((card) => card.roomId === roomId && (!sessionIds.length || sessionIds.includes(card.sessionId)));
      if (cards.length < 3) throw new Error("카드가 3개 이상일 때 요약할 수 있어요.");
      takeAiCall(roomId, "SUMMARY");
      const text = `## 핵심 내용\n${cards.length}개의 카드에서 개선 방향을 정리했어요.\n\n## 주요 논의\n${cards.slice(0, 4).map((card) => `- ${card.title}`).join("\n")}`.slice(0, 1000);
      summary = { id: randomUUID(), text, sessionTitles: sessions.map(({ title }) => title), requestedBy: account.id, savedCardId: null, createdAt: new Date().toISOString() };
      aiMock.summaries.set(roomId, [summary, ...(aiMock.summaries.get(roomId) ?? [])]);
    }
    revalidateBoard(roomId);
    return { ok: true, data: summary };
  } catch (error) { return aiFailure(error, "요약을 만들지 못했어요."); }
}

export async function updateMeetingSummary(roomId: number, summaryId: string, text: string): Promise<AiResult<MeetingSummary>> {
  try {
    const path = summaryPath(roomId, summaryId);
    if (typeof text !== "string" || !text.trim() || text.length > 1000) throw new Error("요약을 1~1,000자로 입력해 주세요.");
    let summary: MeetingSummary;
    if (!isMock) {
      summary = toMeetingSummary(await api<Schemas["SummaryResponse"]>(path, { method: "PATCH", json: { content: text } }));
    } else {
      const { account } = await getAiContext(roomId);
      const existing = aiMock.summaries.get(roomId)?.find(({ id }) => id === summaryId);
      if (!existing || existing.requestedBy !== account.id) throw new Error("본인이 만든 요약만 수정할 수 있어요.");
      existing.text = text;
      summary = existing;
    }
    revalidateBoard(roomId);
    return { ok: true, data: summary };
  } catch (error) { return aiFailure(error, "요약을 수정하지 못했어요."); }
}

export async function saveMeetingSummary(roomId: number, summaryId: string, cardType: IdeaCardType, title: string): Promise<AiResult<number>> {
  try {
    const path = summaryPath(roomId, summaryId);
    const input = cardData.safeParse({ cardType, title });
    if (!input.success) throw new Error("카드 유형을 선택하고 제목을 1~100자로 입력해 주세요.");
    let cardId: number;
    if (!isMock) {
      const card = await api<Schemas["IdeaCardDetailResponse"]>(`${path}/save-as-card`, { method: "POST", json: input.data });
      if (!card.cardId) throw new Error("저장한 카드 정보를 확인할 수 없어요.");
      cardId = card.cardId;
    } else {
      const { account, membership } = await getAiContext(roomId);
      const summary = aiMock.summaries.get(roomId)?.find(({ id }) => id === summaryId);
      if (!summary) throw new Error("회의 요약을 찾을 수 없어요.");
      closeExpiredIdeaSession(roomId);
      const session = boardSessions.find((item) => item.roomId === roomId && item.state === "ACTIVE");
      if (!session) throw new Error("진행 중인 회차가 없어요. 복사를 이용하거나 회차를 시작해 주세요.");
      if (summary.text.length > 1000) throw new Error("요약을 1,000자 이내로 줄여 주세요.");
      cardId = ideaCards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
      ideaCards.push({
        id: cardId, roomId, sessionId: session.id, ...input.data, content: summary.text,
        author: { accountId: account.id, displayName: membership.nickname ?? account.name, memberStatus: "ACTIVE", profileImageUrl: null },
        sortOrder: ideaCards.filter((card) => card.sessionId === session.id && card.cardType === cardType).length,
        commentCount: 0, reactionCount: 0, convertedTaskId: null, createdAt: new Date().toISOString(), aiSuggested: true,
      });
      summary.savedCardId = cardId;
      markIdeaChanged(roomId);
    }
    revalidateBoard(roomId);
    revalidatePath(`/rooms/${roomId}`);
    return { ok: true, data: cardId };
  } catch (error) { return aiFailure(error, "요약을 카드로 저장하지 못했어요."); }
}
