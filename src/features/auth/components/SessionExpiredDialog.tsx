"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SessionExpiredDialog({ loginHref }: { loginHref: string }) {
  const router = useRouter();
  const loginButton = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          loginButton.current?.focus();
        }}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>로그인 세션이 만료됐어요</AlertDialogTitle>
          <AlertDialogDescription>서비스를 계속 이용하려면 다시 로그인해 주세요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction ref={loginButton} onClick={() => router.replace(loginHref)}>
            다시 로그인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
