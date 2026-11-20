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

import { unsuspendAccountAction } from "../actions";
import {
  accountProviderLabel,
  accountRoleLabel,
  accountStatusLabel,
  suspensionPeriodLabel,
} from "../lib/account-labels";
import type { AdminAccountDetail } from "../types";
import {
  AdminAccountRoleBadge,
  AdminAccountStatusBadge,
} from "./AdminAccountStatusBadge";
import { AdminRoleChangeDialog } from "./AdminRoleChangeDialog";
import { AdminSuspendDialog } from "./AdminSuspendDialog";

/**
 * 회원 상세 Sheet. 서버가 로드한 초기 상세를 받아 들여, 액션 성공 시 **로컬 state 로 즉시 반영**
 * (낙관적 반영에 가까운 패턴). 서버 액션이 revalidatePath 도 돌리므로 목록·다음 진입도 최신.
 *
 * ⚠️ URL 쿼리 `selected` 를 Sheet open 상태의 단일 원천으로 둔다 — 공유 가능한 링크 유지.
 * ⚠️ 본인 계정은 **역할 변경/정지 버튼 자체를 비활성** 하고 사유를 툴팁으로 노출한다. 서버가
 *    guard 로 한 번 더 막지만 UI 에서도 선제 차단하는 게 UX 측면에서 깔끔.
 */

interface AdminAccountDetailSheetProps {
  initialDetail: AdminAccountDetail | null;
  /** URL ?selected=<id>. `null` 이면 선택 안 함. */
  selectedId: number | null;
  /** 선택된 ID 는 있는데 상세 조회가 실패한 경우. "선택 안 함" 과 구분. */
  loadFailed: boolean;
  /** 로그인한 관리자 본인 계정 ID — 자기 자신 보호 가드에 쓴다. */
  meAccountId: number;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export function AdminAccountDetailSheet({
  initialDetail,
  selectedId,
  loadFailed,
  meAccountId,
}: AdminAccountDetailSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<AdminAccountDetail | null>(initialDetail);
  const [unsuspending, startUnsuspendTransition] = useTransition();

  // 서버가 새 initialDetail 을 넘기면 반영 — accountId 가 같아도 참조가 바뀌면 서버 쪽에서
  // revalidatePath 등으로 갱신된 스냅샷이므로 덮어쓴다. 액션 성공으로 setDetail 한 뒤
  // revalidatePath 가 돌아 같은 데이터가 다시 내려와도 결과는 동일.
  useEffect(() => {
    if (initialDetail) setDetail(initialDetail);
  }, [initialDetail]);

  // 선택 ID 는 있는데 조회가 실패했다면 로컬 캐시도 지워 "직전 스냅샷" 이 어긋나지 않게.
  useEffect(() => {
    if (loadFailed) setDetail(null);
  }, [loadFailed]);

  const open = selectedId !== null;
  const isMe = detail?.accountId === meAccountId;

  function closeSheet() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("selected");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function retryLoad() {
    router.refresh();
  }

  function handleUnsuspend() {
    if (!detail?.accountId) return;
    startUnsuspendTransition(async () => {
      const result = await unsuspendAccountAction(detail.accountId!);
      if (result.kind === "ok") {
        setDetail(result.detail);
        toast.success("정지를 해제했습니다.");
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
                네트워크 또는 권한 문제로 회원 상세를 가져오지 못했습니다.
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
              <SheetTitle>{detail.name}</SheetTitle>
              <SheetDescription>{detail.email}</SheetDescription>
              <div className="mt-2 flex items-center gap-1.5">
                <AdminAccountRoleBadge role={detail.role} />
                <AdminAccountStatusBadge status={detail.status} />
                {isMe && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    본인
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
              <section className="grid grid-cols-2 gap-3 text-sm">
                <KeyVal label="제공자" value={accountProviderLabel(detail.provider)} />
                <KeyVal label="가입일" value={fmtDate(detail.createdAt)} />
                <KeyVal label="최근 로그인" value={fmtDateTime(detail.lastLoginAt)} />
                <KeyVal label="참여 방 수" value={String(detail.roomCount ?? 0)} />
                <KeyVal label="방장인 방 수" value={String(detail.ownedRoomCount ?? 0)} />
                <KeyVal
                  label="정지 종료"
                  value={detail.suspendedUntil ? fmtDateTime(detail.suspendedUntil) : "-"}
                />
              </section>

              <section>
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  정지 이력
                </h3>
                {(detail.suspensions ?? []).length === 0 ? (
                  <p className="mt-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                    정지 이력이 없습니다.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {(detail.suspensions ?? []).map((s) => (
                      <li
                        key={s.suspensionId}
                        className="rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-600"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            {suspensionPeriodLabel(s.period)}
                          </span>
                          <span className="text-slate-400">
                            {fmtDateTime(s.startedAt)}
                            {s.endsAt && ` ~ ${fmtDateTime(s.endsAt)}`}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600">{s.reason || "(사유 없음)"}</p>
                        {s.releasedAt && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            해제됨 · {fmtDateTime(s.releasedAt)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  관리 액션
                </h3>
                <div
                  className="flex flex-wrap items-center gap-2"
                  // 본인 보호 — Dialog 트리거 자체를 비활성 하고 사유를 보여준다.
                  aria-disabled={isMe}
                  title={isMe ? "본인 계정은 관리 액션 대상에서 제외됩니다." : undefined}
                >
                  {isMe ? (
                    <p className="text-xs text-slate-500">
                      본인 계정 (
                      <span className="font-medium">{accountRoleLabel(detail.role)}</span>
                      ) · 역할·정지 액션은 비활성화됩니다.
                    </p>
                  ) : (
                    <>
                      <AdminRoleChangeDialog detail={detail} onUpdated={setDetail} />
                      {accountStatusLabel(detail.status) === "정지" ? (
                        <button
                          type="button"
                          onClick={handleUnsuspend}
                          disabled={unsuspending}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {unsuspending ? "처리 중…" : "정지 해제"}
                        </button>
                      ) : (
                        <AdminSuspendDialog detail={detail} onUpdated={setDetail} />
                      )}
                    </>
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
      <p className="mt-0.5 text-sm text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
