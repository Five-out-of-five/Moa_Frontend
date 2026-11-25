"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { adoptCompromise, discardCompromise, dismissConflict, generateCompromise } from "./actions";
import { MEDIATION_CARD_LABELS, type MediationDraft, type MediationResult } from "./model";

function useKeepConflict(roomId: number, conflictId: number) {
  const router = useRouter();
  return () => {
    const current = new URL(window.location.href);
    if (current.pathname !== `/rooms/${roomId}/mediation` || current.searchParams.has("conflict")) return;
    current.searchParams.set("conflict", String(conflictId));
    router.replace(current.pathname + current.search, { scroll: false });
  };
}

function Command({ label, pendingLabel = "처리 중…", action, onSaved, disabled }: {
  label: string; pendingLabel?: string; action: () => Promise<MediationResult>; onSaved?: () => void; disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return <Button type="button" disabled={pending || disabled} onClick={() => start(async () => {
    try {
      const result = await action();
      if (result.error) toast.error(result.error);
      else {
        onSaved?.();
        toast.success("변경 사항을 반영했어요.");
      }
    } catch { toast.error("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
  })}>{pending ? pendingLabel : label}</Button>;
}

export function DismissConflict({ roomId, conflictId }: { roomId: number; conflictId: number }) {
  const [open, setOpen] = useState(false);
  const keepConflict = useKeepConflict(roomId, conflictId);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">충돌 해제</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>충돌을 해제할까요?</AlertDialogTitle>
          <AlertDialogDescription>같은 카드 쌍은 다시 감지하지 않아요. 이미 생성한 절충안 초안은 계속 볼 수 있어요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel>
          <Command label="해제하기" action={dismissConflict.bind(null, roomId, conflictId)} onSaved={() => { setOpen(false); keepConflict(); }} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CompromiseEditor({ roomId, conflictId, draft, canAdopt }: {
  roomId: number; conflictId: number; draft: MediationDraft | null; canAdopt: boolean;
}) {
  const keepConflict = useKeepConflict(roomId, conflictId);
  if (!draft) return <div className="border-border rounded-control flex flex-wrap items-center justify-between gap-3 border border-dashed p-4">
    <div><h3 className="text-sm font-semibold">두 의견을 함께 반영한 제안은 어떨까요?</h3><p className="text-muted-foreground mt-1 text-xs">초안은 채택하기 전까지 본인에게만 보여요.</p></div>
    <Command label="절충안 생성" pendingLabel="절충안 생성 중…" action={generateCompromise.bind(null, roomId, conflictId)} onSaved={keepConflict} />
  </div>;
  return <DraftForm key={draft.id} roomId={roomId} conflictId={conflictId} draft={draft} canAdopt={canAdopt} onSaved={keepConflict} />;
}

function DraftForm({ roomId, conflictId, draft, canAdopt, onSaved }: {
  roomId: number; conflictId: number; draft: MediationDraft; canAdopt: boolean; onSaved: () => void;
}) {
  const [result, action, pending] = useActionState(async (previous: MediationResult, data: FormData) => {
    const next = await adoptCompromise(roomId, conflictId, draft.id, previous, data);
    if (next.saved) {
      onSaved();
      toast.success("절충안을 카드로 등록했어요.");
    }
    return next;
  }, {});
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending || !canAdopt) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="bg-secondary/40 rounded-control border-border space-y-3 border p-4">
      <h3 className="text-primary text-sm font-semibold">절충안 초안</h3>
      <p className="text-muted-foreground text-xs">유형 · {MEDIATION_CARD_LABELS[draft.cardType]}</p>
      <label className="block space-y-1 text-sm"><span>제목</span><Input required name="title" maxLength={100} defaultValue={draft.title} /></label>
      <label className="block space-y-1 text-sm"><span>내용</span><Textarea rows={5} name="content" maxLength={1000} defaultValue={draft.content} /></label>
      <p className="text-muted-foreground text-xs">초안은 수정할 수 있어요. 채택하면 진행 중인 회차에 카드로 등록돼요.</p>
      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      <div className="flex flex-wrap gap-2">
        {canAdopt && <Button type="submit" disabled={pending}>{pending ? "저장 중…" : "수정한 내용으로 채택"}</Button>}
        <Command label="초안 폐기" disabled={pending} action={discardCompromise.bind(null, roomId, conflictId, draft.id)} onSaved={onSaved} />
      </div>
    </form>
  );
}
