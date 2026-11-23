"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { getAuthReturnPath } from "../return-path";

let sessionRequest: Promise<{ redirectTo?: string; error?: string }> | null = null;
function completeSession(returnPath?: string, reason?: string) {
  if (!sessionRequest) sessionRequest = fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ returnPath, reason }), signal: AbortSignal.timeout(15000),
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "로그인을 완료하지 못했어요.");
    return body as { redirectTo: string };
  }).finally(() => { sessionRequest = null; });
  return sessionRequest;
}

export function AuthCallback({ returnPath, reason }: { returnPath?: string; reason?: string }) {
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void completeSession(returnPath, reason).then((result) => {
      if (active) window.location.replace(getAuthReturnPath(result.redirectTo) ?? "/workspaces");
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "로그인을 완료하지 못했어요."); });
    return () => { active = false; };
  }, [returnPath, reason]);
  return <main className="bg-background grid min-h-dvh place-items-center p-6"><section className="max-w-md space-y-4 text-center"><h1 className="text-xl font-bold">{error ? "로그인을 완료하지 못했어요" : "로그인을 마무리하고 있어요"}</h1>{error ? <><p role="alert" className="text-destructive text-sm">{error}</p><Button asChild variant="outline"><Link href="/login?error=session">로그인으로 돌아가기</Link></Button></> : <p role="status" className="text-muted-foreground text-sm">잠시만 기다려 주세요.</p>}</section></main>;
}
