"use client";

import { Copy, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_COLUMNS, ideaDateTime } from "@/features/idea/model";
import type { BoardSession, IdeaCardType } from "@/types/db";

import { AiSkeleton } from "./AiSkeleton";
import { SafeMarkdown } from "./SafeMarkdown";
import { saveMeetingSummary, summarizeMeeting, updateMeetingSummary } from "./summary-actions";
import type { MeetingSummary } from "./types";

export function MeetingSummaryDialog({ roomId, history, hasActive, accountId, recent, recentError, visibleCards }: {
  roomId: number; history: BoardSession[]; hasActive: boolean; accountId: number;
  recent: MeetingSummary[]; recentError?: string;
  visibleCards: { id: number; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [text, setText] = useState("");
  const [cardType, setCardType] = useState<IdeaCardType>("AGENDA");
  const [title, setTitle] = useState("인공지능 회의 요약");
  const [error, setError] = useState("");
  const [showSourceCards, setShowSourceCards] = useState(false);
  const [pending, start] = useTransition();
  const canEdit = summary !== null && summary.requestedBy === accountId;
  const openSummary = (item: MeetingSummary) => {
    setSummary(item);
    setText(item.text);
    setError("");
  };
  const run = (action: () => Promise<void>) => start(async () => {
    setError("");
    setShowSourceCards(false);
    try { await action(); } catch { setError("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
  });
  const persist = async () => {
    if (!summary || !canEdit || text === summary.text) return true;
    const result = await updateMeetingSummary(roomId, summary.id, text);
    if (!result.ok) { setError(result.error); return false; }
    openSummary(result.data);
    return true;
  };

  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); if (!value) { setSummary(null); setError(""); } } }}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Sparkles aria-hidden="true" />인공지능 회의 요약</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>인공지능 회의 요약</DialogTitle><DialogDescription>보드 전체 또는 마감된 회차의 주요 내용을 정리해요.</DialogDescription></DialogHeader>
      {!summary && <>
        <fieldset className="space-y-2 text-sm" disabled={pending}>
          <legend className="mb-2 font-semibold">요약 대상</legend>
          <label className="flex gap-2"><input type="radio" name="summary-scope" checked={!selected.length} onChange={() => setSelected([])} />보드 전체</label>
          {history.filter(({ state }) => state === "CLOSED").map((session) => <label key={session.id} className="flex gap-2">
            <input type="checkbox" checked={selected.includes(session.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, session.id] : ids.filter((id) => id !== session.id))} />{session.title}
          </label>)}
        </fieldset>
        <Button disabled={pending} onClick={() => run(async () => {
          const result = await summarizeMeeting(roomId, selected);
          if (result.ok) openSummary(result.data);
          else {
            setError(result.error);
            setShowSourceCards(result.code === "AI_UNAVAILABLE");
          }
        })}>요약 생성</Button>
        <section aria-labelledby="recent-summaries" className="border-border space-y-2 border-t pt-3">
          <h3 id="recent-summaries" className="text-sm font-semibold">최근 요약</h3>
          {recentError ? <div className="flex items-center gap-2">
            <p role="alert" className="text-destructive text-sm">{recentError}</p>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => router.refresh())}>다시 불러오기</Button>
          </div> : recent.length > 0 ? <ul className="divide-border divide-y">
            {recent.map((item) => <li key={item.id}>
              <Button variant="ghost" className="w-full justify-start" disabled={pending} onClick={() => openSummary(item)}>
                <span className="truncate">{item.sessionTitles.join(", ") || "보드 전체"}</span>
                {Number.isFinite(Date.parse(item.createdAt)) && <time dateTime={item.createdAt} className="text-muted-foreground text-xs">{ideaDateTime.format(new Date(item.createdAt))}</time>}
              </Button>
            </li>)}
          </ul> : <p className="text-muted-foreground text-sm">아직 만든 요약이 없어요.</p>}
        </section>
      </>}
      {pending && <AiSkeleton />}
      {summary && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{summary.sessionTitles.join(", ") || "보드 전체"}</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => { setSummary(null); setError(""); }}>요약 목록</Button>
        </div>
        <SafeMarkdown text={text} roomId={roomId} />
        {canEdit && <label className="space-y-1 text-sm">
          <span>요약 수정</span>
          <Textarea rows={6} value={text} maxLength={1000} disabled={pending} onChange={(event) => setText(event.target.value)} />
        </label>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={async () => {
            try { await navigator.clipboard.writeText(text); toast.success("요약을 복사했어요."); }
            catch { toast.error("복사하지 못했어요."); }
          }}><Copy aria-hidden="true" />요약 복사</Button>
          {canEdit && <Button variant="outline" disabled={pending || !text.trim() || text === summary.text} onClick={() => run(async () => {
            if (await persist()) toast.success("요약을 수정했어요.");
          })}>수정 저장</Button>}
        </div>
        {summary.savedCardId !== null ? <a className="text-primary text-sm underline" href={`/api/rooms/${roomId}/assistant?card=${summary.savedCardId}`}>저장한 카드 보기</a>
          : hasActive ? <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            if (pending || !title.trim() || !text.trim()) return;
            run(async () => {
              if (!(await persist())) return;
              const result = await saveMeetingSummary(roomId, summary.id, cardType, title);
              if (!result.ok) setError(result.error);
              else {
                setSummary((item) => item && { ...item, savedCardId: result.data });
                toast.success("요약을 카드로 저장했어요.");
              }
            });
          }}>
            <fieldset className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]" disabled={pending}>
              <label className="space-y-1"><span>카드 유형</span>
                <select className="border-input bg-background h-9 w-full rounded-md border px-2" value={cardType} onChange={(event) => {
                  const column = IDEA_COLUMNS.find(({ type }) => type === event.target.value);
                  if (column) setCardType(column.type);
                }}>{IDEA_COLUMNS.map(({ type, title }) => <option key={type} value={type}>{title}</option>)}</select>
              </label>
              <label className="space-y-1"><span>카드 제목</span><Input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            </fieldset>
            <Button disabled={pending || !text.trim() || !title.trim()}>카드로 저장</Button>
          </form> : <p className="text-muted-foreground text-xs">카드로 저장하려면 회차를 시작해 주세요.</p>}
      </>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {showSourceCards && visibleCards.length > 0 && <section aria-label="현재 보드의 원본 카드" className="space-y-2 text-sm">
        <p className="font-medium">현재 보드의 원본 카드</p>
        <ul className="list-disc space-y-1 pl-5">{visibleCards.map(({ id, title }) => <li key={id}>
          <a href={`/api/rooms/${roomId}/assistant?card=${id}`} className="text-primary underline">{title}</a>
        </li>)}</ul>
      </section>}
    </DialogContent>
  </Dialog>;
}
