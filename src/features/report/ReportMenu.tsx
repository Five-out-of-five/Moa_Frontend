"use client";

import { Archive, Flag, MoreHorizontal, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

import { submitReportAction } from "./actions";
import { REPORT_REASONS, type ReportResult, type ReportTarget } from "./model";

export function ReportMenu({ target }: { target: ReportTarget }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${target.content.split("\n")[0]} 더보기`}
            className="size-7"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive" onSelect={() => setIsOpen(true)}>
            <Flag aria-hidden="true" />
            신고하기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && <ReportForm target={target} onClose={() => setIsOpen(false)} />}
      </Dialog>
    </>
  );
}

function ReportForm({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [state, action, isPending] = useActionState<ReportResult, FormData>(submitReportAction, {});
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (state.saved) {
      toast.success("신고가 접수되었어요.");
      onClose();
    } else if (state.error) toast.error(state.error);
  }, [state, onClose]);
  const label =
    target.type === "CARD" ? "아이디어 카드" : target.type === "COMMENT" ? "댓글" : "채팅 메시지";
  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      showCloseButton={false}
      onInteractOutside={(event) => {
        if (isPending) event.preventDefault();
      }}
      onEscapeKeyDown={(event) => {
        if (isPending) event.preventDefault();
      }}
    >
      <Button type="button" variant="ghost" size="icon" aria-label="신고 창 닫기" className="absolute top-3 right-3 size-7" disabled={isPending} onClick={onClose}><X aria-hidden="true" /></Button>
      <DialogHeader>
        <DialogTitle>신고하기</DialogTitle>
        <DialogDescription>신고 내용을 확인한 후 운영자가 조치합니다.</DialogDescription>
      </DialogHeader>
      <form action={action} onReset={(event) => event.preventDefault()} className="space-y-5">
        <input type="hidden" name="roomId" value={target.roomId} />
        <input type="hidden" name="targetId" value={target.id} />
        <input type="hidden" name="targetType" value={target.type} />
        <div className="bg-muted/40 border-border rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {label} · {target.author}
          </p>
          <p className="text-muted-foreground mt-2 line-clamp-3 break-words whitespace-pre-wrap">
            {target.content}
          </p>
        </div>
        <fieldset disabled={isPending} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            신고 사유 <span className="text-destructive">필수</span>
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REPORT_REASONS.map((item) => (
              <label
                key={item.value}
                className="border-border has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <input
                  type="radio"
                  name="reason"
                  value={item.value}
                  defaultChecked={reason === item.value}
                  onChange={() => setReason(item.value)}
                  required
                  className="accent-primary"
                />
                {item.label}
              </label>
            ))}
          </div>
          {state.reasonError && (
            <p role="alert" className="text-destructive text-xs">
              {state.reasonError}
            </p>
          )}
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="report-detail" className="text-sm font-medium">
            상세 내용 <span className="text-muted-foreground">선택</span>
          </label>
          <Textarea
            id="report-detail"
            name="detail"
            defaultValue={detail}
            onChange={(event) => setDetail(event.target.value)}
            disabled={isPending}
            maxLength={500}
            placeholder="운영자가 확인할 내용을 구체적으로 적어 주세요."
            className="min-h-24 resize-none"
            aria-describedby="report-detail-count"
          />
          <p id="report-detail-count" className="text-muted-foreground text-right text-xs">
            {detail.length}/500
          </p>
          {state.detailError && (
            <p role="alert" className="text-destructive text-xs">
              {state.detailError}
            </p>
          )}
        </div>
        <p className="bg-muted/40 text-muted-foreground flex gap-2 rounded-md p-3 text-xs">
          <Archive aria-hidden="true" className="size-4 shrink-0" />
          검토를 위해 신고 당시의 내용이 기록에 보관됩니다.
        </p>
        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            취소
          </Button>
          <SubmitButton hasReason={Boolean(reason)} />
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SubmitButton({ hasReason }: { hasReason: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!hasReason || pending}>
      {pending ? "접수 중…" : "신고 접수"}
    </Button>
  );
}
