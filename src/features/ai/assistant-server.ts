import "server-only";

import { randomUUID } from "node:crypto";

import { getLiveIdeaCard } from "@/features/idea/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards, tasks, votes } from "@/mocks/db";

import { encodeAssistantEvent } from "./assistant-events";
import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext } from "./server";
import type { AiMessage } from "./types";

export const assistantStreamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

export async function openAssistantStream(roomId: number, input: string, signal: AbortSignal) {
  const question = input.trim();
  if (!question || input.length > 200) throw new ApiError(400, "질문을 1~200자로 입력해 주세요.", "COMMON_INVALID_INPUT");
  if (!isMock) {
    const response = await api(`/api/v1/rooms/${roomId}/ai/assistant/messages`, {
      method: "POST", json: { question }, eventStream: true, signal, cache: "no-store", timeoutMs: 40_000, allowAuthRefresh: true,
    });
    return new Response(response.body, { headers: assistantStreamHeaders });
  }
  const { key } = await getAiContext(roomId);
  const history = aiMock.messages.get(key) ?? [];
  if (history.some(({ state }) => state === "streaming")) throw new ApiError(503, "진행 중인 응답을 먼저 중단해 주세요.", "AI_UNAVAILABLE");
  signal.throwIfAborted();
  const refund = takeAiCall(roomId, "ASSISTANT");
  const cards = ideaCards.filter((card) => card.roomId === roomId);
  const work = tasks.filter((task) => task.roomId === roomId);
  const polls = votes.filter((vote) => vote.roomId === roomId && vote.status === "OPEN");
  const answer = `## 팀 협업 현황\n\n- 아이디어 **${cards.length}개**\n- 미완료 업무 **${work.filter((task) => task.status !== "DONE").length}개**\n- 진행 중인 투표 **${polls.length}개**`;
  const message: AiMessage = { id: randomUUID(), question, answer: "", state: "streaming", createdAt: new Date().toISOString() };
  history.push(message);
  aiMock.messages.set(key, history);
  let timer: ReturnType<typeof setTimeout>;
  let dispose = () => {};
  let disposeOnCancel: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = () => {
        if (message.state !== "streaming") return;
        message.state = message.answer ? "stopped" : "failed";
        if (!message.answer) refund();
        dispose();
      };
      const abort = () => { finish(); controller.close(); };
      dispose = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
      const send = () => {
        const text = answer.slice(message.answer.length, message.answer.length + 12);
        message.answer += text;
        controller.enqueue(encodeAssistantEvent({ event: "delta", data: { text } }));
        if (message.answer.length < answer.length) {
          timer = setTimeout(send, 45);
          return;
        }
        message.references = {
          cards: cards.slice(0, 2).map(({ id, title }) => ({ id, title })),
          tasks: work.slice(0, 2).map(({ taskId, title }) => ({ id: taskId, title })),
          votes: polls.slice(0, 2).map(({ voteId, title }) => ({ id: voteId, title })),
        };
        controller.enqueue(encodeAssistantEvent({ event: "references", data: message.references }));
        controller.enqueue(encodeAssistantEvent({ event: "done", data: { messageId: message.id, status: "COMPLETED" } }));
        message.state = "complete";
        dispose();
        controller.close();
      };
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(send, 350);
      disposeOnCancel = finish;
    },
    cancel() { disposeOnCancel?.(); },
  });
  return new Response(stream, { headers: assistantStreamHeaders });
}

export async function resolveAssistantCard(roomId: number, cardId: number) {
  let archivedSessionId: number | undefined;
  if (isMock) {
    await getAiContext(roomId);
    const card = ideaCards.find((item) => item.roomId === roomId && item.id === cardId);
    if (!card) return null;
    archivedSessionId = boardSessions.find((item) => item.roomId === roomId && item.id === card.sessionId && item.state === "CLOSED")?.id;
  } else {
    const card = await getLiveIdeaCard(roomId, cardId);
    if (!card) return null;
    if (card.sessionClosed) archivedSessionId = card.sessionId;
  }
  return `/rooms/${roomId}/boards/idea?${archivedSessionId ? `session=${archivedSessionId}&` : ""}open=${cardId}&briefingFocus=${cardId}`;
}
