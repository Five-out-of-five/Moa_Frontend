import "server-only";

import { ApiError } from "@/lib/api";
import type { RoomWidget } from "@/types/db";

import type { AiMessage, MeetingSummary } from "./types";

type State = {
  messages: Map<string, AiMessage[]>;
  proposals: Map<string, { id: string; widgets: RoomWidget[]; revision: number }>;
  summaries: Map<number, MeetingSummary[]>;
  undos: Map<string, { revision: number; widgets: RoomWidget[] }>;
  calls: Map<string, number>;
};
const runtime = globalThis as typeof globalThis & { moaAi?: State };
export const aiMock: State = (runtime.moaAi ??= {
  messages: new Map(), proposals: new Map(), summaries: new Map(), undos: new Map(), calls: new Map(),
});
aiMock.summaries ??= new Map();

const LIMITS = { ASSISTANT: 30, SUMMARY: 10, LAYOUT: 5, TONE: 100, COMPROMISE: 10 };
type MockFeature = keyof typeof LIMITS;

function dailyKey(roomId: number, feature: MockFeature) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  for (const key of aiMock.calls.keys()) if (!key.startsWith(date)) aiMock.calls.delete(key);
  return `${date}:${roomId}:${feature}`;
}

export function mockAiQuota(roomId: number) {
  return (Object.keys(LIMITS) as MockFeature[]).map((feature) => ({
    feature, limit: LIMITS[feature], used: aiMock.calls.get(dailyKey(roomId, feature)) ?? 0,
  }));
}

export function takeAiCall(roomId: number, feature: MockFeature) {
  const key = dailyKey(roomId, feature);
  const used = aiMock.calls.get(key) ?? 0;
  if (used >= LIMITS[feature]) throw new ApiError(429, "오늘의 AI 호출 한도를 초과했어요.", "AI_QUOTA_EXCEEDED");
  aiMock.calls.set(key, used + 1);
  return () => aiMock.calls.set(key, Math.max(0, (aiMock.calls.get(key) ?? 1) - 1));
}
