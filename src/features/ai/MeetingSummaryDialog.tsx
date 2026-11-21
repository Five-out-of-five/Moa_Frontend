"use client";

import { Copy, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { BoardSession, IdeaCard } from "@/types/db";

import { AiSkeleton } from "./AiSkeleton";
import { saveMeetingSummary, summarizeMeeting } from "./summary-actions";
import type { MeetingSummary } from "./types";

export function MeetingSummaryDialog({ roomId, history, hasActive, cards }: { roomId: number; history: BoardSession[]; hasActive: boolean; cards: IdeaCard[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const count = cards.filter((card) => !selected.length || selected.includes(card.sessionId)).length;
  const run = (action: () => Promise<void>) => start(async () => {
    try { await action(); } catch { setError("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
  });
  const generate = (keepText = false) => run(async () => {
    setError("");
    const result = await summarizeMeeting(roomId, selected);
    if (!result.ok) setError(result.error);
    else {
      setSummary(result.data);
      if (!keepText) setText(result.data.text);
    }
  });
  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); if (!value) { setSummary(null); setError(""); } } }}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Sparkles aria-hidden="true" />인공지능 회의 요약</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>인공지능 회의 요약</DialogTitle><DialogDescription>보드 전체 또는 마감된 회차의 주요 내용을 정리해요.</DialogDescription></DialogHeader>
      {!summary && <>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-2 font-semibold">요약 대상</legend>
          <label className="flex gap-2"><input type="checkbox" checked={!selected.length} onChange={() => setSelected([])} />보드 전체</label>
          {history.map((session) => <label key={session.id} className="flex gap-2">
            <input type="checkbox" checked={selected.includes(session.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, session.id] : ids.filter((id) => id !== session.id))} />{session.title}
          </label>)}
        </fieldset>
        <p className="text-muted-foreground text-xs">선택한 카드 {count}개 · 3개 이상 필요해요.</p>
        <Button disabled={pending || count < 3} onClick={() => generate()}>요약 생성</Button>
      </>}
      {pending && <AiSkeleton />}
      {summary && <>
        <p className="text-muted-foreground text-xs">수정 가능한 초안이에요. 원본 카드와 함께 확인해 주세요.</p>
        <Textarea aria-label="회의 요약 초안" rows={12} value={text} maxLength={1000} disabled={pending} onChange={(event) => setText(event.target.value)} />
        <p className="text-muted-foreground text-right text-xs">{text.length}/1,000</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("요약을 복사했어요."); } catch { toast.error("복사하지 못했어요."); } }}><Copy aria-hidden="true" />요약 복사</Button>
          <Button disabled={pending || !hasActive || !text.trim()} onClick={() => run(async () => {
            setError("");
            const result = await saveMeetingSummary(roomId, summary.id, text);
            if (!result.ok) setError(result.error);
            else { setOpen(false); setSummary(null); toast.success("요약을 카드로 저장했어요."); }
          })}>카드로 저장</Button>
          {error && <Button variant="outline" disabled={pending} onClick={() => generate(true)}>편집 내용 유지하고 다시 생성</Button>}
        </div>
        {!hasActive && <p className="text-muted-foreground text-xs">카드로 저장하려면 회차를 시작해 주세요.</p>}
      </>}
      {error && <div role="alert" className="text-destructive space-y-2 text-sm"><p>{error}</p><p className="font-semibold">원본 카드</p><ul>{cards.slice(0, 10).map((card) => <li key={card.id}>{card.title}</li>)}</ul></div>}
    </DialogContent>
  </Dialog>;
}
