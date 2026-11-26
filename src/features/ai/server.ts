import "server-only";

import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import { parseReferences } from "./assistant-events";
import { aiMock, mockAiQuota } from "./mock-state";
import type { AiHistory, AiQuota, MeetingSummary } from "./types";

type Schemas = components["schemas"];

export async function getAiContext(roomId: number) {
  const context = await getManagedRoom(roomId);
  if (!context) throw new ApiError(403, "이 방의 AI 기능에 접근할 수 없어요.", "ROOM_NOT_MEMBER");
  return { ...context, key: `${roomId}:${context.membership.id}` };
}

export async function getAiHistory(roomId: number, before: string | null): Promise<AiHistory> {
  if (isMock) {
    const context = await getAiContext(roomId);
    const all = (aiMock.messages.get(context.key) ?? []).filter(({ state }) => state !== "streaming").toReversed();
    const offset = before ? all.findIndex(({ id }) => id === before) + 1 : 0;
    const items = all.slice(offset, offset + 20);
    const hasNext = all.length > offset + 20;
    return { items, hasNext, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }
  if (before && !/^\d+$/.test(before)) throw new ApiError(400, "대화 이력 위치를 확인해 주세요.", "COMMON_INVALID_INPUT");
  const query = new URLSearchParams({ size: "20", ...(before ? { before } : {}) });
  const history = await api<Schemas["CursorResponseAssistantMessageResponse"]>(
    `/api/v1/rooms/${roomId}/ai/assistant/messages?${query}`, { cache: "no-store", allowAuthRefresh: true },
  );
  return {
    hasNext: history.hasNext === true,
    nextCursor: history.hasNext && history.nextCursor != null ? String(history.nextCursor) : null,
    items: (history.items ?? []).flatMap((item) => item.messageId != null ? [{
      id: String(item.messageId), question: item.question ?? "", answer: item.answer ?? "", createdAt: item.createdAt ?? "",
      state: item.status === "COMPLETED" ? "complete" : item.status === "PARTIAL" ? "stopped" : "failed",
      references: parseReferences(item.references),
    }] : []),
  };
}

export async function getAiQuota(roomId: number): Promise<AiQuota[]> {
  if (isMock) {
    await getAiContext(roomId);
    return mockAiQuota(roomId);
  }
  const { features } = await api<Schemas["AiQuotaResponse"]>(`/api/v1/rooms/${roomId}/ai/quota`, { cache: "no-store", allowAuthRefresh: true });
  return (features ?? []).flatMap(({ feature, used, limit, resetAt }) =>
    feature && used != null && limit != null ? [{ feature, used, limit, resetAt }] : []);
}

export function toMeetingSummary(data: Schemas["SummaryResponse"]): MeetingSummary {
  if (!data.summaryId) throw new Error("요약 정보를 확인할 수 없어요.");
  return {
    id: String(data.summaryId), text: data.content ?? "", sessionTitles: (data.sessions ?? []).flatMap(({ title }) => title ? [title] : []),
    requestedBy: data.requestedBy?.accountId ?? 0, savedCardId: data.savedCardId ?? null, createdAt: data.createdAt ?? "",
  };
}

export async function getMeetingSummaries(roomId: number): Promise<MeetingSummary[]> {
  if (isMock) {
    await getAiContext(roomId);
    return (aiMock.summaries.get(roomId) ?? []).slice(0, 20);
  }
  const data = await api<Schemas["PageResponseSummaryResponse"]>(`/api/v1/rooms/${roomId}/ai/summaries?page=0&size=20`, { cache: "no-store" });
  return (data.content ?? []).map(toMeetingSummary);
}
