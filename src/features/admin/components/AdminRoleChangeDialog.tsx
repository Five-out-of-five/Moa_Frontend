"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { changeAccountRoleAction } from "../actions";
import type { AdminAccountDetail, AdminAccountRole } from "../types";

interface AdminRoleChangeDialogProps {
  detail: AdminAccountDetail;
  onUpdated: (next: AdminAccountDetail) => void;
}

/**
 * 역할 변경 확인 다이얼로그. 요구사항 명세 row 74:
 *   - 관리자 권한은 기존 관리자만 부여
 *   - 본인 관리자 권한은 스스로 해제 불가
 *   - 관리자는 최소 1명 이상 유지
 *
 * ⚠️ 서버 응답 확정 전에 Dialog 를 닫지 않는다. `AlertDialogAction` 의 기본 close 를 막고,
 *    성공 응답이 돌아왔을 때만 수동으로 닫는다.
 */
export function AdminRoleChangeDialog({
  detail,
  onUpdated,
}: AdminRoleChangeDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentRole = (detail.role ?? "USER") as AdminAccountRole;
  const nextRole: AdminAccountRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
  const isPromote = nextRole === "ADMIN";

  function handleConfirm() {
    if (!detail.accountId) return;
    startTransition(async () => {
      const result = await changeAccountRoleAction(detail.accountId!, nextRole);
      if (result.kind === "ok") {
        onUpdated(result.detail);
        toast.success(isPromote ? "관리자로 승격했습니다." : "관리자 권한을 해제했습니다.");
        setOpen(false);
        return;
      }
      toast.error(result.message);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {isPromote ? "관리자로 승격" : "관리자 권한 해제"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isPromote
              ? `${detail.name} 님을 관리자로 승격합니다`
              : `${detail.name} 님의 관리자 권한을 해제합니다`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isPromote
              ? "서비스 관리자 권한을 부여합니다. 관리자 콘솔의 모든 조작은 감사 로그에 기록됩니다."
              : "관리자 콘솔 접근 권한이 사라집니다. 서비스 전체 관리자는 최소 1명 이상 유지되어야 합니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={pending}
          >
            {pending ? "처리 중…" : isPromote ? "승격" : "해제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
