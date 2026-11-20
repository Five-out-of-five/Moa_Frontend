"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { rejectReportAction } from "../actions";
import type { AdminReportDetail } from "../types";

/**
 * 신고 반려 Dialog. 반려 사유를 기록하고 허위·반복 신고 여부를 선택할 수 있다.
 */

interface Props {
  detail: AdminReportDetail;
  onUpdated: (next: AdminReportDetail) => void;
}

export function AdminReportRejectDialog({ detail, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [falseReport, setFalseReport] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setReason("");
      setFalseReport(false);
    }
  }, [open]);

  function handleSubmit() {
    if (!detail.reportId) return;
    if (reason.trim().length === 0) {
      toast.error("반려 사유를 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await rejectReportAction(detail.reportId!, {
        actionReason: reason,
        falseReport,
      });
      if (result.kind === "ok") {
        onUpdated(result.detail);
        toast.success("신고를 반려했습니다.");
        setOpen(false);
        return;
      }
      toast.error(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          반려
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신고 #{detail.reportId} 반려</DialogTitle>
          <DialogDescription>
            반려 사유는 감사 로그에 남고, 신고자에게 결과가 노출됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label
              htmlFor="reject-reason"
              className="text-xs font-medium text-slate-600"
            >
              반려 사유 <span className="text-amber-600">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="커뮤니티 가이드라인에 해당하지 않는 이유 등을 기록하세요."
              rows={3}
              disabled={pending}
              className="mt-1.5"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Checkbox
              checked={falseReport}
              onCheckedChange={(v) => setFalseReport(v === true)}
              disabled={pending}
            />
            허위·반복 신고로 기록
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || reason.trim().length === 0}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "처리 중…" : "반려"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
