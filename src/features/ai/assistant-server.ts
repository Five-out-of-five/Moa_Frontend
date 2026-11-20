import "server-only";

import { randomUUID } from "node:crypto";

import { ideaCards, moodStatuses, tasks, votes } from "@/mocks/db";

import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext } from "./server";

export async function openAssistantStream(roomId: number, question: string, signal: AbortSignal) {
  const { key } = await getAiContext(roomId);
  if (typeof question !== "string" || !question.trim() || question.length > 200) throw new Error("질문을 1~200자로 입력해 주세요.");
  takeAiCall(roomId, "assistant-layout");
  const history = aiMock.messages.get(key) ?? [];
  if (history.some((message) => message.state === "streaming")) throw new Error("이 방에서 진행 중인 응답을 먼저 중단해 주세요.");
  const cards = ideaCards.filter((card) => card.roomId === roomId);
  const work = tasks.filter((task) => task.roomId === roomId);
  const polls = votes.filter((vote) => vote.roomId === roomId && vote.status === "OPEN");
  const moods = moodStatuses.filter((mood) => mood.roomId === roomId);
  const available = cards.length + work.length + polls.length + moods.length;
  const answer = available
    ? `## 팀 협업 현황\n\n현재 방의 기록을 기준으로 정리했어요.\n\n- 아이디어 **${cards.length}개**\n- 미완료 업무 **${work.filter((task) => task.status !== "DONE").length}개**\n- 진행 중인 투표 **${polls.length}개**\n\n### 함께 확인할 내용\n${cards.slice(0, 2).map((card) => `- [${card.title.replace(/[\[\]\\]/g, "")}](/rooms/${roomId}/boards/idea?briefingFocus=${card.id})`).join("\n")}\n${work.slice(0, 2).map((task) => `- [${task.title.replace(/[\[\]\\]/g, "")}](/rooms/${roomId}/boards/task?open=${task.taskId})`).join("\n")}\n\n**다음 단계**로 우선순위를 함께 정하고, 진행 중인 업무부터 확인해 보세요.`
    : "아직 참고할 방 데이터가 부족해요. 아이디어나 업무를 등록한 뒤 질문해 주세요.";
  const message = { id: randomUUID(), question: question.trim(), answer: "", state: "streaming" as const, createdAt: new Date().toISOString() };
  history.push(message);
  aiMock.messages.set(key, history);
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout>;
  let close: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let cursor = 0;
      let closed = false;
      const stop = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", stop);
        const stored = history.find(({ id }) => id === message.id);
        if (stored?.state === "streaming") stored.state = "stopped";
        controller.close();
      };
      close = stop;
      const send = async () => {
        try {
          await getAiContext(roomId);
          if (closed) return;
          const stored = history.find(({ id }) => id === message.id);
          if (!stored) return stop();
          const chunk = answer.slice(cursor, cursor + 12);
          cursor += chunk.length;
          stored.answer += chunk;
          controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: chunk }) + "\n"));
          if (cursor >= answer.length) {
            stored.state = "complete";
            controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
            stop();
          } else timer = setTimeout(() => void send(), 45);
        } catch {
          const stored = history.find(({ id }) => id === message.id);
          if (stored) stored.state = "failed";
          if (!closed) controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: "응답이 중단됐어요. 다시 시도해 주세요." }) + "\n"));
          stop();
        }
      };
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
      else timer = setTimeout(() => void send(), 900);
    },
    cancel() { close?.(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
