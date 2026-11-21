"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { inactivateRoomAction } from "../actions";
import type { AdminRoomDetail } from "../types";

/**
 * 방 비활성화 Dialog — 사유 필수 입력. 서버가 비활성 사유를 감사 로그에 기록한다.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AdminRoomDetail;
  onUpdated: (next: AdminRoomDetail) => void;
}

export function AdminRoomInactivateDialog({
  open,
  onOpenChange,
  detail,
  onUpdated,
}: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  function handleSubmit() {
    if (!detail.roomId) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError("비활성 사유를 입력해 주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await inactivateRoomAction(detail.roomId!, trimmed);
        if (result.kind === "ok") {
          onUpdated(result.detail);
          toast.success("방을 비활성 처리했습니다.");
          onOpenChange(false);
          return;
        }
        setError(result.message);
      } catch {
        setError(
          "요청을 전송하지 못했습니다. 다시 시도해 주세요. 서버에 반영되었을 수도 있으니 목록을 확인해 주세요.",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>『{detail.name}』 비활성화</DialogTitle>
          <DialogDescription>
            비활성 상태인 방은 신규 참여가 중단되고 상단에 안내가 표시됩니다. 사유는
            감사 로그에 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label
              htmlFor="inactivate-reason"
              className="text-xs font-medium text-slate-600"
            >
              비활성 사유 <span className="text-amber-600">*</span>
            </Label>
            <Textarea
              id="inactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="장기 미사용 · 신고 다수 · 요청에 의한 보류 등"
              rows={4}
              disabled={pending}
              className="mt-1.5"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || reason.trim().length === 0}
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "처리 중…" : "비활성화"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
