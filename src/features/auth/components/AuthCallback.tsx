"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import { useAuthCallback } from "./useAuthCallback";

export function AuthCallback({ returnPath, reason }: { returnPath?: string; reason?: string }) {
  const { failure, retry } = useAuthCallback(returnPath, reason);
  return <main className="bg-background grid min-h-dvh place-items-center p-6"><section className="max-w-md space-y-4 text-center"><h1 className="text-xl font-bold">{failure ? "로그인을 완료하지 못했어요" : "로그인을 마무리하고 있어요"}</h1>{failure ? <>
    <p role="alert" className="text-destructive text-sm">{failure.error}</p>
    {failure.traceId && <p className="text-muted-foreground text-xs">오류 확인 번호: {failure.traceId}</p>}
    <div className="flex justify-center gap-2"><Button type="button" onClick={retry}>다시 시도</Button><Button asChild variant="outline"><Link href="/login">로그인으로 돌아가기</Link></Button></div>
  </> : <p role="status" className="text-muted-foreground text-sm">잠시만 기다려 주세요.</p>}</section></main>;
}
