"use client";

import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

import type { AdminRoomPage } from "../types";
import { AdminRoomStatusBadge } from "./AdminRoomStatusBadge";

interface Props {
  page: AdminRoomPage;
  selectedId: number | null;
}

const KST_DATE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const KST_DATETIME = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmtDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return KST_DATE.format(d);
}
function fmtDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return KST_DATETIME.format(d);
}

export function AdminRoomsTable({ page, selectedId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigateToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPage));
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  }

  function openDetail(roomId: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("selected", String(roomId));
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  }

  const rows = page.content;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">방 이름</th>
              <th className="px-4 py-2.5 text-left font-medium">방장</th>
              <th className="px-4 py-2.5 text-right font-medium">멤버</th>
              <th className="px-4 py-2.5 text-right font-medium">신고</th>
              <th className="px-4 py-2.5 text-left font-medium">최근 활동</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
              <th className="px-4 py-2.5 text-left font-medium">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => {
              const roomId = row.roomId ?? 0;
              const highlighted = roomId === selectedId;
              const reportHigh = (row.reportCount ?? 0) >= 3;
              return (
                <tr
                  key={roomId}
                  onClick={() => openDetail(roomId)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50",
                    highlighted && "bg-slate-50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[280px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(roomId);
                      }}
                      aria-label={`${row.name} 상세 열기`}
                      className="-mx-1 block truncate rounded px-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.creator?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {(row.memberCount ?? 0).toLocaleString("ko-KR")}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      reportHigh && "text-amber-700",
                    )}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      {(row.reportCount ?? 0).toLocaleString("ko-KR")}
                      {reportHigh && (
                        <AlertTriangle
                          aria-label="신고 다수"
                          className="h-3.5 w-3.5"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {fmtDateTime(row.lastActivityAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminRoomStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {fmtDate(row.createdAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  조건에 맞는 방이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          총{" "}
          <span className="font-semibold text-slate-800">
            {page.totalElements.toLocaleString("ko-KR")}
          </span>{" "}
          개 · {page.page + 1} / {page.totalPages} 페이지
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => navigateToPage(page.page - 1)}
            disabled={page.page <= 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" /> 이전
          </button>
          <button
            type="button"
            onClick={() => navigateToPage(page.page + 1)}
            disabled={!page.hasNext}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
          >
            다음 <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
