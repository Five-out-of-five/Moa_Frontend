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
} from "@/components/ui/alert-dialog";

import { deleteNoticeAction } from "../actions";

/**
 * 공지 삭제 AlertDialog. 되돌릴 수 없는 액션이라 확인 경로 유지.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noticeId: number;
  title: string;
  /** 삭제 성공 시 Sheet 를 닫고 선택 ID 를 URL 에서 제거하도록 상위에 알림. */
  onDeleted: () => void;
}

export function AdminNoticeDeleteDialog({
  open,
  onOpenChange,
  noticeId,
  title,
  onDeleted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteNoticeAction(noticeId);
        if (result.kind === "ok-void") {
          toast.success("공지를 삭제했습니다.");
          onDeleted();
          onOpenChange(false);
          return;
        }
        setError(result.message);
      } catch {
        // 전송 오류 — 서버 반영 여부 확신 못 하므로 "삭제 실패" 로 단정하지 않고 재시도 안내.
        setError(
          "요청을 전송하지 못했습니다. 다시 시도해 주세요. 서버에 반영되었을 수도 있으니 목록을 확인해 주세요.",
        );
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>공지 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            『{title}』 공지를 삭제합니다. 삭제된 공지는 되살릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {pending ? "삭제 중…" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
