"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leaveRoomAction } from "@/features/room/actions";

import { checkWithdrawalAction, withdrawAccountAction } from "../actions";
import { INITIAL_SETTINGS_RESULT, type WithdrawalResult } from "../settings-types";
import { SettingsSubmit } from "./SettingsForms";

export function LeaveWorkspaceDialog({ id, name }: { id: number; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [, action, pending] = useActionState(async () => {
    const next = await leaveRoomAction(id);
    if (next.success) {
      setIsOpen(false);
      toast.success(next.message);
    } else {
      toast.error(next.message);
    }
    return next;
  }, INITIAL_SETTINGS_RESULT);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !pending && setIsOpen(open)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          나가기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{name}에서 나갈까요?</AlertDialogTitle>
          <AlertDialogDescription>
            작성한 카드와 메시지는 방에 남고, 담당 중인 업무는 미담당으로 바뀝니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action}>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
            <SettingsSubmit>워크스페이스 나가기</SettingsSubmit>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RetryRoomRoleButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
      {isPending ? "확인 중…" : "역할 다시 확인"}
    </Button>
  );
}

export function WithdrawalDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !isSubmitting && setIsOpen(open)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive">계정 탈퇴</Button>
      </AlertDialogTrigger>
      {isOpen && <WithdrawalContent onSubmitting={setIsSubmitting} />}
    </AlertDialog>
  );
}

function WithdrawalContent({ onSubmitting }: { onSubmitting: (pending: boolean) => void }) {
  const [result, setResult] = useState<WithdrawalResult>();
  const [isChecking, startChecking] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [submission, submit, isSubmitting] = useActionState(async (previous: WithdrawalResult, data: FormData) => {
    onSubmitting(true);
    try {
      const next = await withdrawAccountAction(previous, data);
      if (next.check || next.message) setResult(next);
      return next;
    } finally {
      onSubmitting(false);
    }
  }, {});
  const status = result?.check;
  const message = result?.message;
  return (
      <AlertDialogContent onOpenAutoFocus={() => {
        if (result || isChecking) return;
        startChecking(async () => setResult(await checkWithdrawalAction()));
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>계정 탈퇴</AlertDialogTitle>
          <AlertDialogDescription>
            탈퇴하면 작성한 카드와 메시지는 남습니다. 같은 소셜 계정으로는 다시 가입할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isChecking && <p role="status" className="text-sm">탈퇴 가능 여부 확인 중…</p>}
        {message && <p role="alert" className="text-destructive text-sm">{message}</p>}
        {status && !status.withdrawable && (
          <div className="space-y-2 text-sm">
            <p>방장 권한을 위임하거나 해당 방을 삭제한 후 탈퇴할 수 있습니다.</p>
            <ul className="space-y-1">
              {status.ownedRooms.map(({ roomId, name, memberCount }) => (
                <li key={roomId}>
                  <Link href={`/workspaces/manage?room=${roomId}`} className="underline">{name}</Link>
                  {memberCount != null && ` · 멤버 ${memberCount}명`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {status?.withdrawable && status.canWithdraw ? (
          <form action={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-confirmation">탈퇴합니다를 입력해 주세요.</Label>
              <Input id="withdraw-confirmation" name="confirmText" value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} disabled={isSubmitting}
                aria-invalid={Boolean(submission.confirmError)} />
              {submission.confirmError && <p role="alert" className="text-destructive text-sm">{submission.confirmError}</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>취소</AlertDialogCancel>
              <Button variant="destructive" disabled={isSubmitting || confirmation !== "탈퇴합니다"}>
                {isSubmitting ? "처리 중…" : "탈퇴 확정"}
              </Button>
            </AlertDialogFooter>
          </form>
        ) : (
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            {message && !isChecking && (
              <Button type="button" onClick={() => startChecking(async () => setResult(await checkWithdrawalAction()))}>
                다시 확인
              </Button>
            )}
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
  );
}
