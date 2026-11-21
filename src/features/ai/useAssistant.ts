"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AiMessage } from "./types";

export function useAssistant(roomId: number) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const endpoint = `/api/rooms/${roomId}/assistant`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("대화 이력을 불러오지 못했어요.");
      const history: AiMessage[] = await response.json();
      if (!signal?.aborted) setMessages(history);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "대화를 불러오지 못했어요.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => { controller.abort(); request.current?.abort(); };
  }, [load]);

  async function send(question: string) {
    if (request.current || !question.trim() || question.length > 200) return;
    const controller = new AbortController();
    request.current = controller;
    const id = crypto.randomUUID();
    setPending(true); setError("");
    setMessages((items) => [...items, { id, question, answer: "", state: "streaming", createdAt: new Date().toISOString() }]);
    const update = (edit: (item: AiMessage) => AiMessage) => setMessages((items) => items.map((item) => item.id === id ? edit(item) : item));
    let timeout = window.setTimeout(() => controller.abort("timeout"), 30000);
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(typeof body.error === "string" ? body.error : "응답을 시작하지 못했어요.");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("응답을 읽을 수 없어요.");
      const decoder = new TextDecoder();
      let buffer = "", done = false;
      while (!controller.signal.aborted) {
        const result = await reader.read();
        if (result.done) break;
        clearTimeout(timeout);
        timeout = window.setTimeout(() => controller.abort("timeout"), 30000);
        buffer += decoder.decode(result.value, { stream: true });
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const value = JSON.parse(buffer.slice(0, index)) as { type: string; text?: string; message?: string };
          buffer = buffer.slice(index + 1);
          if (value.type === "error") throw new Error(value.message ?? "응답 중 오류가 발생했어요.");
          if (value.type === "delta" && typeof value.text === "string" && !controller.signal.aborted) {
            update((item) => ({ ...item, answer: item.answer + value.text }));
          }
          if (value.type === "done") done = true;
        }
      }
      if (!done && !controller.signal.aborted) throw new Error("연결이 끊겼어요. 다시 시도해 주세요.");
      update((item) => ({ ...item, state: controller.signal.aborted ? "stopped" : "complete" }));
    } catch (cause) {
      const stopped = controller.signal.aborted && controller.signal.reason !== "timeout";
      update((item) => ({ ...item, state: stopped ? "stopped" : "failed" }));
      if (!stopped) setError(controller.signal.reason === "timeout" ? "응답 대기 시간이 길어졌어요. 다시 시도해 주세요." : cause instanceof Error ? cause.message : "응답하지 못했어요.");
    } finally {
      clearTimeout(timeout); request.current = null; setPending(false);
    }
  }
  return { messages, pending, error, loading, send, reload: load, stop: () => request.current?.abort() };
}
