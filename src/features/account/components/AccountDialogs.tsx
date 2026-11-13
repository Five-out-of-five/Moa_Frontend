"use client";

import { useActionState, useState } from "react";
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

export function WithdrawalDialog({ hasOwnedRooms }: { hasOwnedRooms: boolean }) {
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
            {hasOwnedRooms
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
