"use client";

import { startTransition, useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompromiseDraft } from "@/types/db";

import { adoptCompromise, discardCompromise, dismissConflict, generateCompromise } from "./actions";
import type { MediationResult } from "./model";

function Command({ label, action }: { label: string; action: () => Promise<MediationResult> }) {
  const [pending, start] = useTransition();
  return <Button type="button" disabled={pending} onClick={() => start(async () => {
    try {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success("변경 사항을 반영했어요.");
    } catch { toast.error("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
  })}>{pending ? "처리 중…" : label}</Button>;
}

export function DismissConflict({ roomId, conflictId }: { roomId: number; conflictId: number }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">충돌 해제</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>충돌을 해제할까요?</AlertDialogTitle>
          <AlertDialogDescription>같은 카드 쌍은 다시 감지하지 않으며, 작성 중인 절충안 초안도 지워져요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel>
          <Command label="해제하기" action={dismissConflict.bind(null, roomId, conflictId)} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CompromiseEditor({ roomId, conflictId, draft, title }: {
  roomId: number; conflictId: number; draft?: CompromiseDraft; title: string;
}) {
  if (!draft) return <div className="border-border rounded-control flex flex-wrap items-center justify-between gap-3 border border-dashed p-4">
    <div><h3 className="text-sm font-semibold">두 의견을 함께 반영한 제안은 어떨까요?</h3><p className="text-muted-foreground mt-1 text-xs">초안은 채택하기 전까지 본인에게만 보여요.</p></div>
    <Command label="절충안 생성" action={generateCompromise.bind(null, roomId, conflictId)} />
  </div>;
  return <DraftForm key={draft.id} roomId={roomId} conflictId={conflictId} draft={draft} title={title} />;
}

function DraftForm({ roomId, conflictId, draft, title }: { roomId: number; conflictId: number; draft: CompromiseDraft; title: string }) {
  const [result, action, pending] = useActionState(adoptCompromise.bind(null, roomId, conflictId, draft.id), {});
  useEffect(() => { if (result.saved) toast.success("절충안을 카드로 등록했어요."); }, [result]);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="bg-secondary/40 rounded-control border-border space-y-3 border p-4">
      <h3 className="text-primary text-sm font-semibold">절충안 초안</h3>
      <label className="block space-y-1 text-sm"><span>제목</span><Input required name="title" maxLength={100} defaultValue={title.slice(0, 100)} /></label>
      <label className="block space-y-1 text-sm"><span>내용</span><Textarea required rows={5} name="content" maxLength={1000} defaultValue={draft.content} /></label>
      <p className="text-muted-foreground text-xs">초안은 수정할 수 있어요. 채택하면 진행 중인 회차에 카드로 등록돼요.</p>
      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "저장 중…" : "수정한 내용으로 채택"}</Button>
        <Command label="초안 폐기" action={discardCompromise.bind(null, roomId, conflictId, draft.id)} />
      </div>
    </form>
  );
}
