"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminNoticeDetail } from "../types";
import { AdminNoticeFilters } from "./AdminNoticeFilters";
import { AdminNoticeFormDialog } from "./AdminNoticeFormDialog";

/**
 * 공지 관리 상단 툴바 — 필터 + "신규 공지" 버튼 + 생성 Dialog. 서버 페이지는 Toolbar 컴포넌트
 * 하나만 끼워 넣고, Dialog 오픈/닫기 state 는 여기에서 소유.
 *
 * 생성 성공 시 새 공지 ID 를 `?selected=` 로 URL 에 붙여 상위 Sheet 가 바로 열리게 한다.
 */

interface Props {
  initialNoticeType: string;
  initialState: string;
}

export function AdminNoticesToolbar({
  initialNoticeType,
  initialState,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleCreated(next: AdminNoticeDetail) {
    if (!next.noticeId) return;
    const nextUrl = new URLSearchParams(searchParams.toString());
    nextUrl.set("selected", String(next.noticeId));
    startTransition(() => {
      router.replace(`${pathname}?${nextUrl.toString()}`, { scroll: false });
    });
  }

  return (
    <>
      <AdminNoticeFilters
        initialNoticeType={initialNoticeType}
        initialState={initialState}
        onCreate={() => setOpen(true)}
      />
      <AdminNoticeFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
