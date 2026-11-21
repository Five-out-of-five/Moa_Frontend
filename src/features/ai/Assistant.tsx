"use client";

import { Bot, Maximize2, Minimize2, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { AiSkeleton } from "./AiSkeleton";
import { SafeMarkdown } from "./SafeMarkdown";
import { useAssistant } from "./useAssistant";

export function Assistant({ roomId }: { roomId: number }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className="fixed right-5 bottom-5 z-40 rounded-full shadow-md"><Bot aria-hidden="true" />AI 어시스턴트</Button></DialogTrigger>
    <DialogContent className={`top-auto right-4 bottom-4 left-auto flex h-[min(42rem,90dvh)] w-[calc(100%-2rem)] translate-x-0 translate-y-0 flex-col p-0 ${expanded ? "sm:max-w-3xl" : "sm:max-w-md"}`}>
      {open && <AssistantPanel roomId={roomId} expanded={expanded} onExpand={() => setExpanded(!expanded)} />}
    </DialogContent>
  </Dialog>;
}

function AssistantPanel({ roomId, expanded, onExpand }: { roomId: number; expanded: boolean; onExpand: () => void }) {
  const { messages, pending, error, loading, send, stop, reload } = useAssistant(roomId);
  const [question, setQuestion] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
  return <>
    <DialogHeader className="border-border border-b p-4 pr-12">
      <DialogTitle className="flex items-center gap-2 text-base"><Bot aria-hidden="true" className="size-4" />MOA AI 어시스턴트</DialogTitle>
      <DialogDescription>현재 방의 협업 기록을 함께 살펴보세요.</DialogDescription>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={expanded ? "기본 크기" : "대화 확대"}
        className="absolute top-3 right-12" onClick={onExpand}>
        {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </Button>
    </DialogHeader>
    <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-4 ${expanded ? "text-base" : ""}`} aria-label="대화 내용">
      {loading ? <AiSkeleton /> : !messages.length && <p className="bg-secondary rounded-control p-3 text-sm">안녕하세요. 현재 방의 업무, 아이디어, 투표 현황을 함께 정리해 드릴게요.</p>}
      {messages.map((message) => <div key={message.id} className="space-y-2">
        <p className="bg-secondary ml-6 rounded-lg p-3 text-sm break-words">{message.question}</p>
        <div className="bg-muted/40 rounded-lg p-3">
          {message.state === "streaming" && !message.answer ? <AiSkeleton /> : <SafeMarkdown text={message.answer} roomId={roomId} />}
          {message.state === "stopped" && <p className="text-muted-foreground mt-2 text-xs">응답을 중단했어요.</p>}
          {message.state === "failed" && <p className="text-muted-foreground mt-2 text-xs">응답을 완료하지 못했어요.</p>}
        </div>
      </div>)}
      {error && <div role="alert" className="text-destructive space-y-2 text-sm"><p>{error}</p>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => messages.length ? void send(messages[messages.length - 1].question) : void reload()}>다시 시도</Button></div>}
      <div ref={end} />
    </div>
    <form className="border-border space-y-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); if (!question.trim()) return; void send(question); setQuestion(""); }}>
      <div className="flex gap-2">
        <Textarea aria-label="AI에게 질문" maxLength={200} rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="팀 활동에 대해 질문하세요." className="min-h-12 resize-none" />
        {pending ? <Button type="button" aria-label="응답 중단" onClick={stop}><Square aria-hidden="true" /></Button>
          : <Button type="submit" aria-label="질문 보내기" disabled={!question.trim() || loading}><Send aria-hidden="true" /></Button>}
      </div>
      <p className="text-muted-foreground text-right text-xs">{question.length}/200 · 답변은 팀의 기록과 함께 확인해 주세요.</p>
    </form>
  </>;
}
