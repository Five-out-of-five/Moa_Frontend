"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readAssistantEvents } from "./assistant-events";
import type { AiHistory, AiMessage, AiQuota } from "./types";

type AssistantError = { kind: "history"; message: string } | { kind: "response"; message: string; question: string };

async function failureMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error?.message === "string" ? body.error.message : fallback;
}

export function useAssistant(roomId: number) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AssistantError | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const request = useRef<AbortController | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const quotaRequest = useRef<AbortController | null>(null);
  const endpoint = `/api/rooms/${roomId}/assistant`;

  const reloadQuota = useCallback(async () => {
    quotaRequest.current?.abort();
    const controller = new AbortController();
    quotaRequest.current = controller;
    try {
      const response = await fetch(`${endpoint}?quota`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return;
      const features: AiQuota[] = await response.json();
      if (!controller.signal.aborted) setQuota(features.find(({ feature }) => feature === "ASSISTANT") ?? null);
    } catch {
      if (!controller.signal.aborted) setQuota(null);
    } finally {
      if (quotaRequest.current === controller) quotaRequest.current = null;
    }
  }, [endpoint]);

  const load = useCallback(async (before?: string) => {
    if (historyRequest.current || request.current) return;
    const controller = new AbortController();
    historyRequest.current = controller;
    const setLoadingState = before ? setLoadingOlder : setLoading;
    setLoadingState(true);
    setError(null);
    try {
      const url = before ? `${endpoint}?before=${encodeURIComponent(before)}` : endpoint;
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(await failureMessage(response, "대화 이력을 불러오지 못했어요."));
      const history: AiHistory = await response.json();
      if (!controller.signal.aborted) {
        const older = [...history.items].reverse();
        setMessages((current) => before ? [...older.filter(({ id }) => !current.some((item) => item.id === id)), ...current] : older);
        setNextCursor(history.nextCursor);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError({ kind: "history", message: cause instanceof Error ? cause.message : "대화 이력을 불러오지 못했어요." });
    } finally {
      if (historyRequest.current === controller) {
        historyRequest.current = null;
        setLoadingState(false);
        if (!before) void reloadQuota();
      }
    }
  }, [endpoint, reloadQuota]);

  useEffect(() => {
    void load();
    return () => {
      historyRequest.current?.abort();
      request.current?.abort();
      quotaRequest.current?.abort();
      historyRequest.current = request.current = quotaRequest.current = null;
    };
  }, [load]);

  async function send(input: string) {
    const question = input.trim();
    if (request.current || historyRequest.current || !question || input.length > 200) return;
    const controller = new AbortController();
    request.current = controller;
    const id = crypto.randomUUID();
    setPending(true);
    setError(null);
    setMessages((items) => [...items, { id, question, answer: "", state: "streaming", createdAt: new Date().toISOString() }]);
    const update = (edit: (item: AiMessage) => AiMessage) => setMessages((items) => items.map((item) => item.id === id ? edit(item) : item));
    let timeout: number | undefined;
    const resetTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => controller.abort("timeout"), 40_000);
    };
    resetTimeout();
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
        throw new Error(await failureMessage(response, "응답을 시작하지 못했어요."));
      }
      if (!response.body) throw new Error("응답을 읽을 수 없어요.");
      for await (const event of readAssistantEvents(response.body, resetTimeout)) {
        if (event.event === "delta") update((item) => ({ ...item, answer: item.answer + event.data.text }));
        if (event.event === "references") update((item) => ({ ...item, references: event.data }));
        if (event.event === "error") throw new Error("AI가 잠시 응답하지 않아요. 다시 시도해 주세요.");
        if (event.event === "done") {
          const complete = event.data.status === "COMPLETED";
          update((item) => ({ ...item, id: String(event.data.messageId), state: complete ? "complete" : "stopped" }));
          if (!complete) setError({ kind: "response", question, message: "답변이 중간에 끊겼어요. 다시 시도해 주세요." });
          return;
        }
      }
      throw new Error("답변이 중간에 끊겼어요. 다시 시도해 주세요.");
    } catch (cause) {
      if (request.current !== controller) return;
      const stopped = controller.signal.aborted && controller.signal.reason !== "timeout";
      update((item) => ({ ...item, state: item.answer ? "stopped" : "failed" }));
      if (!stopped) setError({
        kind: "response", question,
        message: controller.signal.reason === "timeout" ? "응답 대기 시간이 길어졌어요. 다시 시도해 주세요." : cause instanceof Error ? cause.message : "응답하지 못했어요.",
      });
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
        void reloadQuota();
      }
    }
  }

  return { messages, pending, error, loading, loadingOlder, nextCursor, quota, send, load, stop: () => request.current?.abort() };
}
