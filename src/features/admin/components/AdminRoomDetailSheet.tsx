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

  useEffect(() => {
    if (initialDetail) setDetail(initialDetail);
  }, [initialDetail]);

  useEffect(() => {
    if (loadFailed) setDetail(null);
  }, [loadFailed]);

  // 선택이 바뀌면 열린 Dialog 는 닫는다.
  useEffect(() => {
    setInactivateOpen(false);
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
    startReactivateTransition(async () => {
      const result = await reactivateRoomAction(requestedId);
      if (result.kind === "ok") {
        setDetail((current) =>
          current && result.detail.roomId === current.roomId
            ? result.detail
            : current,
        );
        toast.success("방을 다시 활성화했습니다.");
        return;
      }
      toast.error(result.message);
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
