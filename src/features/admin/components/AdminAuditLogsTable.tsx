"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  auditActionTypeLabel,
  auditTargetTypeLabel,
} from "../lib/audit-log-labels";
import type { AdminAuditLogPage } from "../types";

/**
 * 감사 로그 테이블 — 읽기 전용. 좁은 화면은 가로 스크롤 (`overflow-x-auto`). 상세 Sheet 없이
 * 한 행이 모든 정보를 보여 준다.
 */

interface Props {
  page: AdminAuditLogPage;
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

export function AdminAuditLogsTable({ page }: Props) {
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

  const rows = page.content ?? [];
  const totalElements = page.totalElements ?? 0;
  const totalPages = page.totalPages ?? 1;
  const currentPage = page.page ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">시각</th>
              <th className="px-4 py-2.5 text-left font-medium">관리자</th>
              <th className="px-4 py-2.5 text-left font-medium">액션</th>
              <th className="px-4 py-2.5 text-left font-medium">대상</th>
              <th className="px-4 py-2.5 text-left font-medium">세부</th>
              <th className="px-4 py-2.5 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => (
              <tr key={row.auditLogId}>
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {row.admin?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {auditActionTypeLabel(row.actionType)}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    {auditTargetTypeLabel(row.targetType)}
                    {row.targetId !== undefined && (
                      <span className="text-xs text-slate-400 tabular-nums">
                        #{row.targetId}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 truncate max-w-[280px]">
                  {row.detail ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums">
                  {row.ipAddress ?? "-"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  조건에 맞는 감사 로그가 없습니다.
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
            {totalElements.toLocaleString("ko-KR")}
          </span>{" "}
          건 · {currentPage + 1} / {totalPages} 페이지
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" /> 이전
          </button>
          <button
            type="button"
            onClick={() => navigateToPage(currentPage + 1)}
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
