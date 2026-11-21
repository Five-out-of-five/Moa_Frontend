"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { AdminNoticeDetail } from "../types";
import { AdminNoticeDeleteDialog } from "./AdminNoticeDeleteDialog";
import { AdminNoticeFormDialog } from "./AdminNoticeFormDialog";
import {
  AdminNoticeStateBadge,
  AdminNoticeTypeBadge,
} from "./AdminNoticeTypeBadge";

/**
 * 공지 상세 Sheet. 서버 로드 상세를 받아 들여, 수정/삭제 액션 성공 시 로컬 state 즉시 반영.
 *
 * `initialDetail` 가 바뀌면(revalidatePath 반영) 로컬 상태를 덮어쓰되, 요청 시점 ID 가 current 와
 * 어긋나면 skip (다른 관리자 Sheet 와 같은 패턴).
 */

interface Props {
  initialDetail: AdminNoticeDetail | null;
  selectedId: number | null;
  loadFailed: boolean;
}

const KST_DATETIME = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmtDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return KST_DATETIME.format(d);
}

/** `displayStartsAt` + `displayEndsAt` 로 상태 로컬 추정 (목/실 양쪽 안전). */
function computeState(detail: AdminNoticeDetail | null): string | undefined {
  if (!detail?.displayStartsAt || !detail?.displayEndsAt) return undefined;
  const now = Date.now();
  const s = Date.parse(detail.displayStartsAt);
  const e = Date.parse(detail.displayEndsAt);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return undefined;
  if (now < s) return "SCHEDULED";
  if (now > e) return "EXPIRED";
  return "ACTIVE";
}

export function AdminNoticeDetailSheet({
  initialDetail,
  selectedId,
  loadFailed,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<AdminNoticeDetail | null>(initialDetail);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (initialDetail) setDetail(initialDetail);
  }, [initialDetail]);

  useEffect(() => {
    if (loadFailed) setDetail(null);
  }, [loadFailed]);

  // 선택이 바뀌면 열려 있던 수정/삭제 Dialog 를 닫는다 — 이전 공지의 Dialog 가 새 공지를 겨냥한
  // 채로 남는 사고 방지.
  useEffect(() => {
    setEditOpen(false);
    setDeleteOpen(false);
  }, [selectedId]);

  const open = selectedId !== null;

  function closeSheet() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("selected");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function retryLoad() {
    router.refresh();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
      >
        <SheetContent className="w-full sm:max-w-lg" closeButtonMobileOnly>
          {loadFailed && !detail && (
            <div className="flex flex-col gap-3 px-5 py-6">
              <SheetHeader className="p-0">
                <SheetTitle>상세를 불러오지 못했습니다</SheetTitle>
                <SheetDescription>
                  네트워크 또는 권한 문제로 공지 상세를 가져오지 못했습니다.
                </SheetDescription>
              </SheetHeader>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={retryLoad}
                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          {detail && (
            <>
              <SheetHeader className="px-5 pr-12 sm:pr-5">
                <SheetTitle className="break-all">{detail.title}</SheetTitle>
                <SheetDescription>공지 #{detail.noticeId}</SheetDescription>
                <div className="mt-2 flex items-center gap-1.5">
                  <AdminNoticeTypeBadge type={detail.noticeType} />
                  <AdminNoticeStateBadge state={computeState(detail)} />
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
                <section>
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    본문
                  </h3>
                  <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {detail.content || "(내용 없음)"}
                  </p>
                </section>

                <section className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <KeyVal
                    label="표시 시작"
                    value={fmtDateTime(detail.displayStartsAt)}
                  />
                  <KeyVal
                    label="표시 종료"
                    value={fmtDateTime(detail.displayEndsAt)}
                  />
                  {detail.noticeType === "MAINTENANCE" && (
                    <KeyVal
                      label="점검 시작"
                      value={fmtDateTime(detail.maintenanceStartsAt)}
                    />
                  )}
                </section>

                <section className="border-t border-slate-200 pt-4">
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    관리 액션
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      삭제
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {detail?.noticeId !== undefined && (
        <>
          <AdminNoticeFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            detail={detail}
            onUpdated={(next) => {
              // 늦게 도착한 수정 응답이 **다른 공지로 전환된 현재 상세** 를 덮지 않도록 가드.
              // 현재 선택된 noticeId 와 응답 noticeId 가 일치할 때만 반영.
              setDetail((current) =>
                current && next.noticeId === current.noticeId ? next : current,
              );
            }}
          />
          <AdminNoticeDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            noticeId={detail.noticeId}
            title={detail.title ?? ""}
            onDeleted={closeSheet}
          />
        </>
      )}
    </>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
