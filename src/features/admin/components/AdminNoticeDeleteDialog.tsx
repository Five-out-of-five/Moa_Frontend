"use client";

import { useTransition } from "react";
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

  function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await deleteNoticeAction(noticeId);
      if (result.kind === "ok-void") {
        toast.success("공지를 삭제했습니다.");
        onDeleted();
        onOpenChange(false);
        return;
      }
      toast.error(result.message);
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
