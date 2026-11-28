"use client";

import { type ReactElement, type ReactNode, type RefObject, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { IdeaCard, IdeaCardType } from "@/types/db";

import { closeIdeaSession, deleteIdeaCard, startIdeaSession } from "./actions";
import { IdeaCardFields } from "./IdeaCardFields";
import { IDEA_COLUMNS, type IdeaFormResult } from "./model";
import { type IdeaCardRetry, saveIdeaDraft } from "./save-idea-draft";
import { useIdeaEditLock } from "./useIdeaEditLock";

type FormAction = (state: IdeaFormResult, data: FormData) => Promise<IdeaFormResult>;

function IdeaDialog({
  trigger, title, description, action, children, submit, lockRoomId, lockCardId, isRetrying = false,
}: {
  trigger: ReactElement; title: string; description: string; action: FormAction;
  children?: ReactNode; submit: string;
  lockRoomId?: number; lockCardId?: number; isRetrying?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { lock, resetLock, retryLock } = useIdeaEditLock(open, lockRoomId, lockCardId);
  const submitting = useRef(false);

  function changeOpen(next: boolean) {
    if (!next && submitting.current) return;
    if (next) resetLock();
    setOpen(next);
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        {open && lockCardId !== undefined && !lock.ready && (
          <div className="space-y-2">
            <p role={lock.error ? "alert" : "status"} className="text-sm">{lock.error ?? "편집 잠금을 확인하고 있어요."}</p>
            {lock.error && <Button type="button" variant="outline" onClick={retryLock}>잠금 다시 확인</Button>}
          </div>
        )}
        {open && (lockCardId === undefined || lock.acquired) && (
          <IdeaDialogForm action={action} submit={submit} submitting={submitting}
            lockedOut={lockCardId !== undefined && !lock.ready} isRetrying={isRetrying} onSaved={() => setOpen(false)}>
            {children}
          </IdeaDialogForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IdeaDialogForm({
  action, submit, children, onSaved, submitting, lockedOut, isRetrying,
}: {
  action: FormAction; submit: string; children: ReactNode; onSaved: () => void;
  submitting: RefObject<boolean>; lockedOut: boolean; isRetrying: boolean;
}) {
  const [result, submitAction, pending] = useActionState(async (previous: IdeaFormResult, data: FormData) => {
    try {
      return await action(previous, data);
    } finally {
      submitting.current = false;
    }
  }, {});
  useEffect(() => {
    if (!result.saved) return;
    toast.success("변경 사항을 반영했어요.");
    onSaved();
  }, [onSaved, result.saved]);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (lockedOut || pending || submitting.current) return;
      const data = new FormData(event.currentTarget);
      submitting.current = true;
      startTransition(() => submitAction(data));
    }} className="space-y-4">
      <fieldset disabled={lockedOut || isRetrying} className="space-y-4">{children}</fieldset>
      {isRetrying && <p role="status" className="text-muted-foreground text-sm">저장 결과를 확인하지 못했어요. 이전 입력과 첨부로 다시 저장할 수 있어요.</p>}
      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline" disabled={pending}>취소</Button></DialogClose>
        <Button type="submit" disabled={pending || lockedOut}>
          {pending ? "처리 중…" : isRetrying ? "다시 저장하기" : submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

function IdeaConfirmation({ trigger, title, description, action, submit }: {
  trigger: ReactElement; title: string; description: string; action: FormAction; submit: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        {open && <IdeaConfirmationForm action={action} submit={submit} onSaved={() => setOpen(false)} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function IdeaConfirmationForm({ action, submit, onSaved }: { action: FormAction; submit: string; onSaved: () => void }) {
  const [result, submitAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (!result.saved) return;
    toast.success("변경 사항을 반영했어요.");
    onSaved();
  }, [onSaved, result.saved]);
  return (
    <form action={submitAction} className="space-y-4">
      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending}>취소</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={pending}>{pending ? "처리 중…" : submit}</Button>
      </AlertDialogFooter>
    </form>
  );
}

export function StartIdeaDialog({ roomId, trigger }: { roomId: number; trigger: ReactElement }) {
  return (
    <IdeaDialog trigger={trigger} title="회차 시작" description="회차 이름을 입력하세요."
      action={startIdeaSession.bind(null, roomId)} submit="시작하기">
      <label className="block space-y-2 text-sm font-medium">
        <span>회차 이름</span><Input name="title" required maxLength={50} placeholder="예: 이번 주 제품 회고" />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>마감 시간 (선택)</span><Input type="datetime-local" name="endsAt" />
        <span className="text-muted-foreground block text-xs font-normal">설정한 시각에 자동으로 마감돼요.</span>
      </label>
    </IdeaDialog>
  );
}

export function CloseIdeaDialog({ roomId, sessionId, trigger }: { roomId: number; sessionId: number; trigger: ReactElement }) {
  return (
    <IdeaConfirmation trigger={trigger} title="회차 마감" description="마감한 회차는 다시 열 수 없어요. 지난 회차에서 카드를 확인할 수 있어요."
      action={closeIdeaSession.bind(null, roomId, sessionId)} submit="마감하기" />
  );
}

export function IdeaCardDialog({ roomId, sessionId, trigger, defaultType = "AGENDA", card, canUpload = false }: {
  roomId: number; sessionId: number; trigger: ReactElement; defaultType?: IdeaCardType; card?: IdeaCard; canUpload?: boolean;
}) {
  const [retry, setRetry] = useState<IdeaCardRetry | null>(null);
  async function save(previous: IdeaFormResult, form: FormData) {
    const next = await saveIdeaDraft(roomId, sessionId, card?.id ?? null, previous, form, retry);
    setRetry(next.retry);
    return next.result;
  }
  return (
    <IdeaDialog trigger={trigger} title={card ? "카드 수정" : "새 카드 추가"} description="핵심 내용을 짧고 명확하게 작성해 주세요."
      action={save} submit={card ? "저장하기" : "추가하기"} isRetrying={retry !== null}
      lockRoomId={card ? roomId : undefined} lockCardId={card?.id}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">분류</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {IDEA_COLUMNS.filter(({ type }) => !card || card.cardType === type).map(({ type, title }) => (
            <label key={type} className="rounded-control border-border hover:bg-muted has-checked:border-primary/30 has-checked:bg-secondary focus-within:ring-ring cursor-pointer border px-1.5 py-2 text-center text-xs focus-within:ring-2">
              <input className="sr-only" type="radio" name="type" value={type} defaultChecked={type === (card?.cardType ?? defaultType)} />
              {title}
            </label>
          ))}
        </div>
      </fieldset>
      <IdeaCardFields roomId={roomId} sessionId={sessionId} card={card} />
      {!card && canUpload && <label className="block space-y-2 text-sm">
        <span>첨부 파일 · 최대 5개</span>
        <Input type="file" name="attachment" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.pptx,.txt,.md,.zip" />
      </label>}
    </IdeaDialog>
  );
}

export function DeleteIdeaDialog({ roomId, cardId, trigger }: { roomId: number; cardId: number; trigger: ReactElement }) {
  return (
    <IdeaConfirmation trigger={trigger} title="카드 삭제" description="삭제하면 카드와 카드에 달린 반응을 되돌릴 수 없어요."
      action={deleteIdeaCard.bind(null, roomId, cardId)} submit="삭제하기" />
  );
}
