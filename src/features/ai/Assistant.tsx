"use client";

import { Bot, Minus, Send, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { AiSkeleton } from "./AiSkeleton";
import { SafeMarkdown } from "./SafeMarkdown";
import { useAssistant } from "./useAssistant";

export function Assistant({ roomId }: { roomId: number }) {
  const [open, setOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); setSessionOpen(value); }}>
    <DialogTrigger asChild><Button className="fixed right-5 bottom-5 z-40 rounded-full shadow-md"><Bot aria-hidden="true" />AI 어시스턴트</Button></DialogTrigger>
    {sessionOpen && <AssistantPanel roomId={roomId} open={open} onMinimize={() => setOpen(false)} />}
  </Dialog>;
}

function AssistantPanel({ roomId, open, onMinimize }: { roomId: number; open: boolean; onMinimize: () => void }) {
  const { messages, pending, error, loading, loadingOlder, nextCursor, quota, send, stop, load } = useAssistant(roomId);
  const [question, setQuestion] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const latest = messages.at(-1);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "nearest" }); }, [latest, open]);
  const suggested = ["지금 가장 급한 업무는?", "이번 회고 내용을 요약해 줘.", "진행 중인 투표가 있어?"];
  return <DialogContent className="top-auto right-4 bottom-4 left-auto flex h-[min(42rem,90dvh)] w-[calc(100%-2rem)] translate-x-0 translate-y-0 flex-col p-0 sm:max-w-md">
    <DialogHeader className="border-border border-b p-4 pr-12">
      <DialogTitle className="flex items-center gap-2 text-base"><Bot aria-hidden="true" className="size-4" />MOA AI 어시스턴트</DialogTitle>
      <DialogDescription>현재 방의 협업 기록을 함께 살펴보세요.</DialogDescription>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="어시스턴트 최소화"
        className="absolute top-3 right-12" onClick={onMinimize}>
        <Minus aria-hidden="true" />
      </Button>
    </DialogHeader>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-label="대화 내용">
      {nextCursor && <Button variant="outline" size="sm" disabled={pending || loadingOlder} onClick={() => void load(nextCursor)}>
        {loadingOlder ? "불러오는 중…" : "이전 대화 더 보기"}
      </Button>}
      {loading ? <AiSkeleton /> : !messages.length && <div className="bg-secondary rounded-control space-y-2 p-3 text-sm">
        <p>현재 방의 업무, 아이디어, 투표에 대해 질문해 보세요.</p>
        <div className="flex flex-wrap gap-2">{suggested.map((prompt) => <Button type="button" variant="outline" size="sm" key={prompt} onClick={() => void send(prompt)}>{prompt}</Button>)}</div>
      </div>}
      {messages.map((message) => <div key={message.id} className="space-y-2">
        <p className="bg-secondary ml-6 rounded-lg p-3 text-sm break-words">{message.question}</p>
        <div className="bg-muted/40 rounded-lg p-3">
          {message.state === "streaming" && !message.answer ? <AiSkeleton /> : <SafeMarkdown text={message.answer} roomId={roomId} />}
          {message.references && <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {message.references.cards.map(({ id, title }) => <a key={`card:${id}`} href={`/api/rooms/${roomId}/assistant?card=${id}`} className="text-primary underline">카드 · {title}</a>)}
            {message.references.tasks.map(({ id, title }) => <Link key={`task:${id}`} href={`/rooms/${roomId}/boards/task?open=${id}`} className="text-primary underline">업무 · {title}</Link>)}
            {message.references.votes.map(({ id, title }) => <Link key={`vote:${id}`} href={`/rooms/${roomId}/votes?open=${id}`} className="text-primary underline">투표 · {title}</Link>)}
          </div>}
          {message.state === "stopped" && <p className="text-muted-foreground mt-2 text-xs">답변이 일부만 표시됐어요.</p>}
          {message.state === "failed" && <p className="text-muted-foreground mt-2 text-xs">응답을 완료하지 못했어요.</p>}
        </div>
      </div>)}
      {error && <div role="alert" className="text-destructive space-y-2 text-sm"><p>{error.message}</p>
        <Button variant="outline" size="sm" disabled={loading || pending || loadingOlder} onClick={() => {
          if (error.kind === "response") void send(error.question);
          else void load(nextCursor ?? undefined);
        }}>다시 시도</Button></div>}
      <div ref={end} />
    </div>
    <form className="border-border space-y-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); if (pending || loading || loadingOlder || !question.trim()) return; void send(question); setQuestion(""); }}>
      <div className="flex gap-2">
        <Textarea aria-label="AI에게 질문" maxLength={200} rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="팀 활동에 대해 질문하세요." className="min-h-12 resize-none" />
        {pending ? <Button type="button" aria-label="응답 중단" onClick={stop}><Square aria-hidden="true" /></Button>
          : <Button type="submit" aria-label="질문 보내기" disabled={!question.trim() || loading || loadingOlder}><Send aria-hidden="true" /></Button>}
      </div>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{quota && `남은 횟수 ${Math.max(0, quota.limit - quota.used)}/${quota.limit}`}</span><span>{question.length}/200</span>
      </div>
    </form>
  </DialogContent>;
}
