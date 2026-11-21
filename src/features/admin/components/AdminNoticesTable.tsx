"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

import type { AdminNoticePage } from "../types";
import {
  AdminNoticeStateBadge,
  AdminNoticeTypeBadge,
} from "./AdminNoticeTypeBadge";

/**
 * 공지 테이블 + 페이지네이션. 행 클릭 → `?selected=<noticeId>` → 부모의 상세 Sheet.
 */

interface Props {
  page: AdminNoticePage;
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

function formatRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return "-";
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "-";
  return `${KST_DATE.format(s)} ~ ${KST_DATE.format(e)}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return KST_DATETIME.format(d);
}

export function AdminNoticesTable({ page, selectedId }: Props) {
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

  function openDetail(noticeId: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("selected", String(noticeId));
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
              <th className="px-4 py-2.5 text-left font-medium">제목</th>
              <th className="px-4 py-2.5 text-left font-medium">유형</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
              <th className="px-4 py-2.5 text-left font-medium">표시 기간</th>
              <th className="px-4 py-2.5 text-left font-medium">시작 시각</th>
              <th className="px-4 py-2.5 text-left font-medium">작성자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => {
              const noticeId = row.noticeId ?? 0;
              const highlighted = noticeId === selectedId;
              return (
                <tr
                  key={noticeId}
                  onClick={() => openDetail(noticeId)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50",
                    highlighted && "bg-slate-50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[320px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(noticeId);
                      }}
                      aria-label={`공지 ${row.title} 상세 열기`}
                      className="-mx-1 block truncate rounded px-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
                    >
                      {row.title}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminNoticeTypeBadge type={row.noticeType} />
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminNoticeStateBadge state={row.state} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {formatRange(row.displayStartsAt, row.displayEndsAt)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {formatDateTime(row.displayStartsAt)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.author?.name ?? "-"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  조건에 맞는 공지가 없습니다.
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
