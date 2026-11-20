"use client";

import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

import {
  reportReasonLabel,
  reportTargetTypeLabel,
} from "../lib/report-labels";
import type { AdminReportPage } from "../types";
import { AdminReportStatusBadge } from "./AdminReportStatusBadge";

/**
 * 신고 테이블 + 페이지네이션. 행 클릭 → `?selected=<reportId>` → 부모의 Sheet 가 열린다.
 * 접근성은 회원 테이블과 같은 패턴 — `<tr>` role 을 건드리지 않고 **ID 셀 안 숨긴 버튼**으로
 * 키보드 포커스 받도록.
 */

interface AdminReportsTableProps {
  page: AdminReportPage;
  selectedId: number | null;
}

function formatDateTime(iso: string | undefined): string {
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

export function AdminReportsTable({ page, selectedId }: AdminReportsTableProps) {
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

  function openDetail(reportId: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("selected", String(reportId));
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  }

  const rows = page.content;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">#</th>
              <th className="px-4 py-2.5 text-left font-medium">대상</th>
              <th className="px-4 py-2.5 text-left font-medium">사유</th>
              <th className="px-4 py-2.5 text-left font-medium">신고자</th>
              <th className="px-4 py-2.5 text-left font-medium">피신고자</th>
              <th className="px-4 py-2.5 text-left font-medium">방</th>
              <th className="px-4 py-2.5 text-left font-medium">접수</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => {
              const reportId = row.reportId ?? 0;
              const highlighted = reportId === selectedId;
              return (
                <tr
                  key={reportId}
                  onClick={() => openDetail(reportId)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50",
                    highlighted && "bg-slate-50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900 tabular-nums">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(reportId);
                      }}
                      aria-label={`신고 ${reportId} 상세 열기`}
                      className="-mx-1 rounded px-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
                    >
                      {reportId}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {reportTargetTypeLabel(row.targetType)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {reportReasonLabel(row.reason)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.reporter?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.targetAccount?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 truncate max-w-[180px]">
                    {row.room?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {formatDateTime(row.createdAt)}
                      {row.overdue && (
                        <AlertTriangle
                          aria-label="72시간 이상 미처리"
                          className="h-3.5 w-3.5 text-amber-600"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminReportStatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  조건에 맞는 신고가 없습니다.
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
          건 · {page.page + 1} / {page.totalPages} 페이지
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
