"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { closeExpiredIdeaSession, markIdeaChanged } from "@/features/idea/mock-board";
import { boardSessions, ideaCards } from "@/mocks/db";

import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext } from "./server";
import type { AiResult, MeetingSummary } from "./types";

export async function summarizeMeeting(roomId: number, sessionIds: number[]): Promise<AiResult<MeetingSummary>> {
  try {
    const { key } = await getAiContext(roomId);
    closeExpiredIdeaSession(roomId);
    if (!Array.isArray(sessionIds) || sessionIds.length > 100 || sessionIds.some((id) => !Number.isSafeInteger(id))) throw new Error("요약할 회차를 선택해 주세요.");
    if (sessionIds.some((id) => !boardSessions.some((session) => session.roomId === roomId && session.id === id && session.state === "CLOSED"))) {
      throw new Error("선택 요약은 마감된 회차만 사용할 수 있어요.");
    }
    const cards = ideaCards.filter((card) => card.roomId === roomId && (!sessionIds.length || sessionIds.includes(card.sessionId)));
    if (cards.length < 3) throw new Error("카드가 3개 이상일 때 요약할 수 있어요.");
    takeAiCall(roomId, "summary");
    const text = `핵심 내용\n${cards.length}개의 카드에서 팀의 개선 방향을 정리했어요.\n\n주요 논의\n${cards.slice(0, 4).map((card) => `• ${card.title}`).join("\n")}\n\n추천하는 다음 행동\n• 우선순위를 함께 정하고 다음 회차에서 결과를 확인해요.`.slice(0, 1000);
    const summary = { id: randomUUID(), text, sources: cards.map(({ id, title }) => ({ id, title })) };
    aiMock.summaries.set(key, summary);
    return { ok: true, data: summary };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "요약을 만들지 못했어요." }; }
}

export async function saveMeetingSummary(roomId: number, summaryId: string, text: string): Promise<AiResult<number>> {
  try {
    const { key, account, membership } = await getAiContext(roomId);
    const summary = aiMock.summaries.get(key);
    if (!summary || summary.id !== summaryId) throw new Error("저장할 요약을 다시 생성해 주세요.");
    if (typeof text !== "string" || !text.trim() || text.length > 1000) throw new Error("요약을 1~1,000자로 입력해 주세요.");
    closeExpiredIdeaSession(roomId);
    const session = boardSessions.find((item) => item.roomId === roomId && item.state === "ACTIVE");
    if (!session) throw new Error("진행 중인 회차가 없어요. 복사를 이용하거나 회차를 시작해 주세요.");
    const id = ideaCards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
    ideaCards.push({
      id, roomId, sessionId: session.id, cardType: "AGENDA", title: "인공지능 회의 요약", content: text.trim(),
      author: { accountId: account.id, displayName: membership.nickname ?? account.name, memberStatus: "ACTIVE", profileImageUrl: null },
      sortOrder: ideaCards.filter((card) => card.sessionId === session.id).length,
      commentCount: 0, reactionCount: 0, convertedTaskId: null, createdAt: new Date().toISOString(), aiSuggested: true,
    });
    aiMock.summaries.delete(key);
    markIdeaChanged(roomId);
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    return { ok: true, data: id };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "요약을 저장하지 못했어요." }; }
}
