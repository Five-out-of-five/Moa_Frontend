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

import { resolveReportAction } from "../actions";
import { SUSPENSION_PERIOD_OPTIONS } from "../lib/account-labels";
import { REPORT_ACTION_OPTIONS } from "../lib/report-labels";
import type {
  AdminReportAction,
  AdminReportDetail,
  AdminSuspensionPeriod,
} from "../types";

/**
 * 신고 조치 완료 Dialog. 조치 선택 → 사유 입력 → (SUSPEND_ACCOUNT 이면) 기간 선택 → 제출.
 *
 * ⚠️ `SUSPEND_ACCOUNT` 는 **기간 필수**. 서버 액션도 guard 로 막지만 UI 에서도 제출 버튼을 비활성.
 * ⚠️ 제출 중 Dialog 닫기 방지.
 */

interface Props {
  detail: AdminReportDetail;
  onUpdated: (next: AdminReportDetail) => void;
}

const DEFAULT_ACTION: AdminReportAction = "WARN";
const DEFAULT_PERIOD: AdminSuspensionPeriod = "DAYS_7";

export function AdminReportResolveDialog({ detail, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<AdminReportAction>(DEFAULT_ACTION);
  const [period, setPeriod] = useState<AdminSuspensionPeriod>(DEFAULT_PERIOD);
  const [reason, setReason] = useState("");
  const [falseReport, setFalseReport] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setAction(DEFAULT_ACTION);
      setPeriod(DEFAULT_PERIOD);
      setReason("");
      setFalseReport(false);
    }
  }, [open]);

  function handleSubmit() {
    if (!detail.reportId) return;
    if (reason.trim().length === 0) {
      toast.error("조치 사유를 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await resolveReportAction(detail.reportId!, {
        action,
        actionReason: reason,
        suspensionPeriod: action === "SUSPEND_ACCOUNT" ? period : undefined,
        falseReport,
      });
      if (result.kind === "ok") {
        onUpdated(result.detail);
        toast.success("신고를 처리했습니다.");
        setOpen(false);
        return;
      }
      toast.error(result.message);
    });
  }

  const submitDisabled =
    pending ||
    reason.trim().length === 0 ||
    (action === "SUSPEND_ACCOUNT" && !period);

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
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          조치 완료
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신고 #{detail.reportId} 조치 완료</DialogTitle>
          <DialogDescription>
            조치 유형과 사유가 감사 로그에 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600">조치</Label>
            <div
              className="mt-2 grid grid-cols-2 gap-2"
              role="group"
              aria-label="조치 유형 선택"
            >
              {REPORT_ACTION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={pending}
                  onClick={() => setAction(o.value)}
                  aria-pressed={action === o.value}
                  className={
                    action === o.value
                      ? "rounded-md bg-slate-900 px-2 py-2 text-xs font-semibold text-white"
                      : "rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {action === "SUSPEND_ACCOUNT" && (
            <div>
              <Label className="text-xs font-medium text-slate-600">
                정지 기간 <span className="text-amber-600">*</span>
              </Label>
              <div
                className="mt-2 grid grid-cols-4 gap-2"
                role="group"
                aria-label="정지 기간 선택"
              >
                {SUSPENSION_PERIOD_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={pending}
                    onClick={() => setPeriod(o.value)}
                    aria-pressed={period === o.value}
                    className={
                      period === o.value
                        ? "rounded-md bg-slate-900 px-2 py-2 text-xs font-semibold text-white"
                        : "rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 hover:bg-slate-100"
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label
              htmlFor="resolve-reason"
              className="text-xs font-medium text-slate-600"
            >
              조치 사유 <span className="text-amber-600">*</span>
            </Label>
            <Textarea
              id="resolve-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="조치 내용과 판단 근거를 간단히 기록하세요."
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
            disabled={submitDisabled}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "처리 중…" : "조치 완료"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
