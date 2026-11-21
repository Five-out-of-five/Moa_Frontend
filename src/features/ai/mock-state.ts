import "server-only";

import type { AiMessage, LayoutProposal, MeetingSummary } from "./types";

type State = {
  messages: Map<string, AiMessage[]>;
  proposals: Map<string, LayoutProposal>;
  summaries: Map<string, MeetingSummary>;
  undos: Map<string, { revision: number; widgets: LayoutProposal["widgets"] }>;
  calls: Map<string, number>;
};
const runtime = globalThis as typeof globalThis & { moaAi?: State };
export const aiMock: State = (runtime.moaAi ??= {
  messages: new Map(), proposals: new Map(), summaries: new Map(), undos: new Map(), calls: new Map(),
});

export function takeAiCall(roomId: number, feature: string) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  for (const key of aiMock.calls.keys()) if (!key.startsWith(date)) aiMock.calls.delete(key);
  const key = `${date}:${roomId}:${feature}`;
  const configured = Number(process.env.AI_DAILY_CALL_LIMIT ?? "50");
  const max = Number.isSafeInteger(configured) && configured > 0 ? configured : 50;
  const used = aiMock.calls.get(key) ?? 0;
  if (used >= max) throw new Error("오늘의 AI 호출 한도를 초과했어요. 내일 다시 시도해 주세요.");
  aiMock.calls.set(key, used + 1);
}
