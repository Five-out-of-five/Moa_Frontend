"use client";

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
import { leaveRoomAction } from "@/features/room/actions";

import { INITIAL_SETTINGS_RESULT } from "../settings-types";
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

export function WithdrawalDialog({ hasOwnedRooms }: { hasOwnedRooms: boolean | null }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          계정 탈퇴
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>계정 탈퇴</AlertDialogTitle>
          <AlertDialogDescription>
            {hasOwnedRooms === null
              ? "워크스페이스 소유 여부를 확인하지 못했습니다. 참여 중인 워크스페이스에서 역할을 다시 확인해 주세요."
              : hasOwnedRooms
              ? "방장인 워크스페이스가 있습니다. 방장 권한을 위임하거나 해당 방을 삭제한 후 탈퇴할 수 있습니다."
              : "탈퇴하면 작성한 카드와 메시지는 협업 이력으로 남습니다. 같은 소셜 계정으로는 탈퇴 30일 후부터 다시 가입할 수 있습니다. 계정 탈퇴 처리는 아직 제공되지 않습니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>닫기</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
