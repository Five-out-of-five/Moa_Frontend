"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WIDGET_TITLES } from "@/features/widget/widget-info";

import { AiSkeleton } from "./AiSkeleton";
import { applyAiLayout, recommendLayout, undoAiLayout } from "./layout-actions";
import type { LayoutProposal } from "./types";

export function LayoutRecommendation({ roomId }: { roomId: number }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [proposal, setProposal] = useState<LayoutProposal | null>(null);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState(false);
  const [pending, start] = useTransition();
  const perform = (action: () => Promise<void>) => start(async () => {
    try { await action(); } catch { setError("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
  });
  return <div className="flex flex-wrap items-center gap-2">
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setProposal(null); setError(""); } }}>
      <DialogTrigger asChild><Button><Sparkles aria-hidden="true" />인공지능 레이아웃 추천</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>인공지능 레이아웃 추천</DialogTitle><DialogDescription>팀 상황이나 대시보드 사용 목적을 알려주세요.</DialogDescription></DialogHeader>
        {!proposal && <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault(); setError("");
          perform(async () => { const result = await recommendLayout(roomId, purpose); if (result.ok) setProposal(result.data); else setError(result.error); });
        }}>
          <Textarea aria-label="대시보드 사용 목적" maxLength={200} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="예: 업무 진행 상황을 먼저 보고 싶어요." />
          <Button disabled={pending || !purpose.trim()}>추천받기</Button>
        </form>}
        {pending && <AiSkeleton />}
        {proposal && <div className="space-y-4">
          <div aria-label="추천 배치 미리보기" className="bg-muted grid grid-cols-12 gap-1 rounded p-2" style={{ gridAutoRows: "15px" }}>
            {proposal.widgets.map((widget) => <div key={widget.id} className="border-border bg-card text-primary overflow-hidden rounded border p-1 text-xs"
              style={{ gridColumn: `${widget.x + 1} / span ${widget.width}`, gridRow: `${widget.y + 1} / span ${widget.height}` }}>{WIDGET_TITLES[widget.widgetType]}</div>)}
          </div>
          <p className="text-sm">{proposal.reason}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button disabled={pending}>이 레이아웃 적용</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>방 전체에 적용할까요?</AlertDialogTitle><AlertDialogDescription>모든 멤버의 대시보드 배치가 변경됩니다.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
                <Button disabled={pending} onClick={() => perform(async () => {
                  const result = await applyAiLayout(roomId, proposal.id);
                  if (!result.ok) setError(result.error);
                  else { setOpen(false); setUndo(true); toast.success(result.data); }
                })}>적용하기</Button></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </DialogContent>
    </Dialog>
    {undo && <Button variant="outline" disabled={pending} onClick={() => perform(async () => {
      const result = await undoAiLayout(roomId);
      if (result.ok) { toast.success(result.data); setUndo(false); } else toast.error(result.error);
    })}>배치 되돌리기</Button>}
  </div>;
}
