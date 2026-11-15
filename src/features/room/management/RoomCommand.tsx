"use client";

import { useActionState, useEffect, useState } from "react";
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

import type { RoomManagementResult } from "./types";

type ServerCommand = (
  previous: RoomManagementResult,
  data: FormData,
) => Promise<RoomManagementResult>;

export function RoomCommand({
  label,
  action,
  confirmText,
  destructive = false,
  fullWidth = false,
  roomName,
}: {
  label: string;
  action: ServerCommand;
  confirmText?: string;
  destructive?: boolean;
  fullWidth?: boolean;
  roomName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, submit, pending] = useActionState(action, {});
  useEffect(() => {
    if (!result.message) return;
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  }, [result]);

  if (!confirmText) {
    return (
      <form action={submit}>
        <Button
          size={fullWidth ? "default" : "sm"}
          variant={fullWidth ? "default" : "outline"}
          className={fullWidth ? "w-full" : undefined}
          disabled={pending}
        >
          {pending ? "처리 중…" : label}
        </Button>
      </form>
    );
  }

  return (
    <AlertDialog open={open && !result.success} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={destructive ? "destructive" : "outline"}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{confirmText}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={submit} className="space-y-3">
          {roomName && (
            <div className="space-y-2">
              <Input
                name="confirmation"
                aria-label="삭제할 워크스페이스 이름"
                placeholder={roomName}
                required
                aria-invalid={Boolean(result.errors?.confirmation)}
              />
              {result.errors?.confirmation && (
                <p role="alert" className="text-destructive text-sm">
                  {result.errors.confirmation}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
            <Button disabled={pending} variant={destructive ? "destructive" : "default"}>
              {pending ? "처리 중…" : label}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
