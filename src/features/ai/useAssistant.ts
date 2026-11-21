"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AiMessage } from "./types";

type AssistantError = { kind: "history" | "stop"; message: string }
  | { kind: "response"; message: string; question: string };

export function useAssistant(roomId: number) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AssistantError | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const stopRequest = useRef<AbortController | null>(null);
  const endpoint = `/api/rooms/${roomId}/assistant`;
  const load = useCallback(async (background = false) => {
    if (historyRequest.current || request.current) return;
    const controller = new AbortController();
    historyRequest.current = controller;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error();
      const history: AiMessage[] = await response.json();
      if (!Array.isArray(history)) throw new Error();
      if (historyRequest.current === controller) {
        setMessages(history);
        if (!history.some(({ state }) => state === "streaming")) {
          setError((current) => current?.kind === "stop" ? null : current);
        }
      }
    } catch {
      if (historyRequest.current === controller) setError({ kind: "history", message: "대화 이력을 불러오지 못했어요." });
    } finally {
      if (historyRequest.current === controller) {
        historyRequest.current = null;
        if (!background) setLoading(false);
      }
    }
  }, [endpoint]);
  useEffect(() => {
    setMessages([]);
    setPending(false);
    void load();
    return () => {
      historyRequest.current?.abort();
      request.current?.abort();
      stopRequest.current?.abort();
      historyRequest.current = request.current = stopRequest.current = null;
    };
  }, [load]);

  const streaming = messages.find(({ state }) => state === "streaming");
  useEffect(() => {
    if (!streaming || pending || loading || error?.kind === "history") return;
    const timer = window.setTimeout(() => void load(true), 750);
    return () => clearTimeout(timer);
  }, [streaming, pending, loading, error, load]);

  async function send(question: string) {
    if (request.current || historyRequest.current || streaming || !question.trim() || question.length > 200) return;
    const controller = new AbortController();
    request.current = controller;
    const id = crypto.randomUUID();
    setPending(true); setError(null);
    setMessages((items) => [...items, { id, question, answer: "", state: "streaming", createdAt: new Date().toISOString() }]);
    const update = (edit: (item: AiMessage) => AiMessage) => setMessages((items) => items.map((item) => item.id === id ? edit(item) : item));
    let timeout = window.setTimeout(() => controller.abort("timeout"), 30000);
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: controller.signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "응답을 시작하지 못했어요.";
        throw new Error(message);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("응답을 읽을 수 없어요.");
      const decoder = new TextDecoder();
      let buffer = "", done = false, remotelyStopped = false;
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
          if (value.type === "stopped") { done = true; remotelyStopped = true; }
        }
      }
      if (!done && !controller.signal.aborted) throw new Error("연결이 끊겼어요. 다시 시도해 주세요.");
      update((item) => ({ ...item, state: controller.signal.aborted || remotelyStopped ? "stopped" : "complete" }));
    } catch (cause) {
      if (request.current !== controller) return;
      const stopped = controller.signal.aborted && controller.signal.reason !== "timeout";
      update((item) => ({ ...item, state: stopped ? "stopped" : "failed" }));
      if (!stopped) setError({ kind: "response", question, message: controller.signal.reason === "timeout" ? "응답 대기 시간이 길어졌어요. 다시 시도해 주세요." : cause instanceof Error ? cause.message : "응답하지 못했어요." });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }
  async function stop() {
    if (request.current) { request.current.abort(); return; }
    if (!streaming || stopRequest.current) return;
    const controller = new AbortController();
    stopRequest.current = controller;
    setError(null);
    try {
      const response = await fetch(`${endpoint}?messageId=${encodeURIComponent(streaming.id)}`, { method: "DELETE", signal: controller.signal });
      if (!response.ok) throw new Error();
      if (stopRequest.current === controller) void load(true);
    } catch {
      if (stopRequest.current === controller) setError({ kind: "stop", message: "응답을 중단하지 못했어요. 다시 시도해 주세요." });
    } finally {
      if (stopRequest.current === controller) stopRequest.current = null;
    }
  }

  return { messages, pending: pending || Boolean(streaming), sending: pending, error, loading, send, reload: load, stop };
}
