"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { reactivateRoomAction } from "../actions";
import type { AdminRoomDetail } from "../types";
import { AdminRoomInactivateDialog } from "./AdminRoomInactivateDialog";
import { AdminRoomStatusBadge } from "./AdminRoomStatusBadge";

interface Props {
  initialDetail: AdminRoomDetail | null;
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

function fmt(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return KST_DATETIME.format(d);
}

export function AdminRoomDetailSheet({
  initialDetail,
  selectedId,
  loadFailed,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<AdminRoomDetail | null>(initialDetail);
  const [inactivateOpen, setInactivateOpen] = useState(false);
  const [reactivating, startReactivateTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // 선택 세대 토큰 — 선택이 바뀌면 ++ 해 과거 요청의 응답/오류가 새 방에 반영되지 않도록 가드.
  const selectionGenRef = useRef(0);

  useEffect(() => {
    if (initialDetail) setDetail(initialDetail);
  }, [initialDetail]);

  useEffect(() => {
    if (loadFailed) setDetail(null);
  }, [loadFailed]);

  // 선택이 바뀌면 세대 ++ → 열린 Dialog 닫고 이전 액션 오류/상태도 치운다.
  useEffect(() => {
    selectionGenRef.current += 1;
    setInactivateOpen(false);
    setActionError(null);
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

  function handleReactivate() {
    const requestedId = detail?.roomId;
    if (!requestedId) return;
    const myGen = selectionGenRef.current;
    setActionError(null);
    startReactivateTransition(async () => {
      try {
        const result = await reactivateRoomAction(requestedId);
        // 요청 중 사용자가 다른 방으로 전환했다면 응답/오류를 적용하지 않는다.
        if (myGen !== selectionGenRef.current) return;
        if (result.kind === "ok") {
          setDetail((current) =>
            current && result.detail.roomId === current.roomId
              ? result.detail
              : current,
          );
          toast.success("방을 다시 활성화했습니다.");
          return;
        }
        setActionError(result.message);
      } catch {
        if (myGen !== selectionGenRef.current) return;
        // 전송 오류 — 서버 반영 여부 확신 못 하므로 "실패" 로 단정 금지.
        setActionError(
          "요청을 전송하지 못했습니다. 다시 시도해 주세요. 서버에 반영되었을 수도 있으니 목록을 다시 조회해 주세요.",
        );
      }
    });
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
                  네트워크 또는 권한 문제로 방 상세를 가져오지 못했습니다.
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
                <SheetTitle className="break-all">{detail.name}</SheetTitle>
                <SheetDescription>
                  방 #{detail.roomId} · 방장 {detail.creator?.name ?? "-"}
                </SheetDescription>
                <div className="mt-2 flex items-center gap-1.5">
                  <AdminRoomStatusBadge status={detail.status} />
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
                {detail.description && (
                  <section>
                    <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      소개
                    </h3>
                    <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {detail.description}
                    </p>
                  </section>
                )}

                <section className="grid grid-cols-2 gap-3 text-sm">
                  <KeyVal
                    label="멤버 수"
                    value={(detail.memberCount ?? 0).toLocaleString("ko-KR")}
                  />
                  <KeyVal
                    label="신고 수"
                    value={(detail.reportCount ?? 0).toLocaleString("ko-KR")}
                  />
                  <KeyVal label="생성일" value={fmt(detail.createdAt)} />
                  <KeyVal label="최근 활동" value={fmt(detail.lastActivityAt)} />
                </section>

                {detail.status === "INACTIVE" && (
                  <section className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <h3 className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
                      비활성 이력
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap">
                      {detail.inactiveReason || "(사유 없음)"}
                    </p>
                    <p className="mt-2 text-xs text-amber-700">
                      처리자 {detail.inactivatedBy?.name ?? "-"} · {fmt(detail.inactivatedAt)}
                    </p>
                  </section>
                )}

                <section className="border-t border-slate-200 pt-4">
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    관리 액션
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => setInactivateOpen(true)}
                        className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        비활성 처리
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReactivate}
                        disabled={reactivating}
                        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {reactivating ? "처리 중…" : "비활성 해제"}
                      </button>
                    )}
                  </div>
                  {actionError && (
                    <p
                      role="alert"
                      className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                    >
                      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {actionError}
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {detail && (
        <AdminRoomInactivateDialog
          open={inactivateOpen}
          onOpenChange={setInactivateOpen}
          detail={detail}
          onUpdated={(next) => {
            setDetail((current) =>
              current && next.roomId === current.roomId ? next : current,
            );
          }}
        />
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
