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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { suspendAccountAction } from "../actions";
import { SUSPENSION_PERIOD_OPTIONS } from "../lib/account-labels";
import type {
  AdminAccountDetail,
  AdminSuspensionPeriod,
} from "../types";

interface AdminSuspendDialogProps {
  detail: AdminAccountDetail;
  onUpdated: (next: AdminAccountDetail) => void;
}

const DEFAULT_PERIOD: AdminSuspensionPeriod = "DAYS_7";

/**
 * 회원 정지 Dialog. 명세 row 75:
 *   - 정지 사유와 기간을 입력하며, 대상자에게 알림이 발송된다.
 *   - 정지 기간 enum: 3일 / 7일 / 30일 / 영구
 *   - 정지된 회원은 로그인 시 정지 안내 화면으로 이동 (BE 책임)
 *
 * ⚠️ 제출 중 Dialog 닫기 방지 — 제출 완료 전에 다시 눌러 double-submit 되지 않도록.
 */
export function AdminSuspendDialog({
  detail,
  onUpdated,
}: AdminSuspendDialogProps) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<AdminSuspensionPeriod>(DEFAULT_PERIOD);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  // 열릴 때 초기화 — 이전 값 잔상 방지.
  useEffect(() => {
    if (open) {
      setPeriod(DEFAULT_PERIOD);
      setReason("");
    }
  }, [open]);

  function handleSubmit() {
    if (!detail.accountId) return;
    if (reason.trim().length === 0) {
      toast.error("정지 사유를 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await suspendAccountAction(
        detail.accountId!,
        period,
        reason,
      );
      if (result.kind === "ok") {
        onUpdated(result.detail);
        toast.success("회원을 정지했습니다.");
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
          className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          정지 처리
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detail.name} 님 정지</DialogTitle>
          <DialogDescription>
            정지 기간이 끝나면 자동으로 정상 전환됩니다. 정지 이력은 보관됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600">
              정지 기간
            </Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {SUSPENSION_PERIOD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={pending}
                  onClick={() => setPeriod(o.value)}
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

          <div>
            <Label htmlFor="suspend-reason" className="text-xs font-medium text-slate-600">
              정지 사유 <span className="text-amber-600">*</span>
            </Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="신고 내역·위반 약관 조항 등을 입력하세요."
              rows={4}
              disabled={pending}
              className="mt-1.5"
            />
          </div>
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
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "처리 중…" : "정지"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
