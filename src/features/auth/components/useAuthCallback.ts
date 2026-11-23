"use client";

import { useEffect, useState } from "react";

import { getAuthReturnPath } from "../return-path";

type SessionReply = { ok: boolean; error?: string; traceId?: string; redirectTo?: string };
let request: Promise<SessionReply> | null = null;
function completeSession(returnPath?: string, reason?: string) {
  if (!request) request = fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ returnPath, reason }), signal: AbortSignal.timeout(15000),
  }).then(async (response): Promise<SessionReply> => {
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error();
    return { ok: response.ok, error: "error" in data && typeof data.error === "string" ? data.error : undefined, traceId: "traceId" in data && typeof data.traceId === "string" ? data.traceId : undefined, redirectTo: "redirectTo" in data && typeof data.redirectTo === "string" ? data.redirectTo : undefined };
  }).finally(() => { request = null; });
  return request;
}

export function useAuthCallback(returnPath?: string, reason?: string) {
  const [failure, setFailure] = useState<{ error: string; traceId?: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailure(undefined);
    void completeSession(returnPath, reason).then((result) => {
      if (!active) return;
      const next = getAuthReturnPath(result.redirectTo);
      if (result.ok && next) { window.location.replace(next); return; }
      if (!result.ok && result.redirectTo) {
        const login = new URL(result.redirectTo, window.location.origin);
        if (login.origin === window.location.origin && login.pathname === "/login") { window.location.replace(login.pathname + login.search); return; }
      }
      setFailure({ error: result.error ?? "로그인을 완료하지 못했어요. 다시 시도해 주세요.", traceId: result.traceId });
    }).catch(() => { if (active) setFailure({ error: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }); });
    return () => { active = false; };
  }, [returnPath, reason, attempt]);
  return { failure, retry: () => setAttempt((value) => value + 1) };
}
