"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { reviewReportAction } from "../actions";
import {
  reportActionLabel,
  reportReasonLabel,
  reportTargetTypeLabel,
} from "../lib/report-labels";
import type { AdminReportDetail } from "../types";
import { AdminReportRejectDialog } from "./AdminReportRejectDialog";
import { AdminReportResolveDialog } from "./AdminReportResolveDialog";
import { AdminReportStatusBadge } from "./AdminReportStatusBadge";

/**
 * 신고 상세 Sheet. 서버가 로드한 초기 상세를 받아 들여, 액션 성공 시 로컬 state 로 즉시 반영한다.
 * `initialDetail` 가 바뀌면 (revalidatePath 결과 등) 로컬 상태를 덮어 쓴다 — 회원 상세 Sheet 와
 * 같은 패턴.
 *
 * 상태별 액션:
 *  - RECEIVED → "처리 시작" 버튼
 *  - IN_PROGRESS → "조치 완료" + "반려"
 *  - RESOLVED / REJECTED → 처리 이력만 표시
 */

interface Props {
  initialDetail: AdminReportDetail | null;
  selectedId: number | null;
  loadFailed: boolean;
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function AdminReportDetailSheet({
  initialDetail,
  selectedId,
  loadFailed,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<AdminReportDetail | null>(initialDetail);
  const [reviewing, startReviewTransition] = useTransition();

  useEffect(() => {
    if (initialDetail) setDetail(initialDetail);
  }, [initialDetail]);

  useEffect(() => {
    if (loadFailed) setDetail(null);
  }, [loadFailed]);

  const open = selectedId !== null;

  function closeSheet() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("selected");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function retryLoad() {
    router.refresh();
  }

  function handleReview() {
    const requestedId = detail?.reportId;
    if (!requestedId) return;
    startReviewTransition(async () => {
      const result = await reviewReportAction(requestedId);
      if (result.kind === "ok") {
        // 응답이 돌아오는 사이 사용자가 다른 신고를 선택했을 수 있다. 요청한 ID 와 현재 로컬
        // 상세의 ID 가 어긋나면 **무시** — 아니면 늦게 도착한 응답이 지금 화면을 이전 신고의
        // 상세로 바꿔 Dialog 들이 잘못된 대상에 액션을 실행한다.
        setDetail((current) =>
          current?.reportId === requestedId ? result.detail : current,
        );
        toast.success("처리 담당자로 지정되었습니다.");
        return;
      }
      toast.error(result.message);
    });
  }

  return (
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
                네트워크 또는 권한 문제로 신고 상세를 가져오지 못했습니다.
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
              <SheetTitle>신고 #{detail.reportId}</SheetTitle>
              <SheetDescription>
                {reportTargetTypeLabel(detail.targetType)} ·{" "}
                {reportReasonLabel(detail.reason)}
              </SheetDescription>
              <div className="mt-2 flex items-center gap-1.5">
                <AdminReportStatusBadge status={detail.status} />
                {detail.overdue && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    72시간 초과
                  </span>
                )}
                {detail.targetDeleted && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    대상 삭제됨
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
              <section className="grid grid-cols-2 gap-3 text-sm">
                <KeyVal label="신고자" value={detail.reporter?.name ?? "-"} />
                <KeyVal label="피신고자" value={detail.targetAccount?.name ?? "-"} />
                <KeyVal label="방" value={detail.room?.name ?? "-"} />
                <KeyVal label="접수일" value={fmtDateTime(detail.createdAt)} />
              </section>

              <section>
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  신고 내용
                </h3>
                <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {detail.detail || "(내용 없음)"}
                </p>
              </section>

              {detail.snapshot && (
                <section>
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    원본 스냅샷
                  </h3>
                  <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">
                    {detail.snapshot}
                  </p>
                </section>
              )}

              {(detail.status === "RESOLVED" || detail.status === "REJECTED") && (
                <section className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    처리 이력
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <KeyVal
                      label="조치"
                      value={detail.action ? reportActionLabel(detail.action) : "-"}
                    />
                    <KeyVal
                      label="처리자"
                      value={detail.handledBy?.name ?? "-"}
                    />
                    <KeyVal
                      label="처리 일시"
                      value={fmtDateTime(detail.handledAt)}
                    />
                  </div>
                  {detail.actionReason && (
                    <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {detail.actionReason}
                    </p>
                  )}
                </section>
              )}

              <section className="border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  관리 액션
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.status === "RECEIVED" && (
                    <button
                      type="button"
                      onClick={handleReview}
                      disabled={reviewing}
                      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {reviewing ? "처리 중…" : "처리 시작"}
                    </button>
                  )}
                  {detail.status === "IN_PROGRESS" && (
                    <>
                      <AdminReportResolveDialog
                        detail={detail}
                        onUpdated={setDetail}
                      />
                      <AdminReportRejectDialog
                        detail={detail}
                        onUpdated={setDetail}
                      />
                    </>
                  )}
                  {(detail.status === "RESOLVED" || detail.status === "REJECTED") && (
                    <p className="text-xs text-slate-500">
                      이미 처리된 신고입니다. 추가 액션은 기록만 남길 수 있는 감사 로그로
                      이동해 확인하세요.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value}</p>
    </div>
  );
}
