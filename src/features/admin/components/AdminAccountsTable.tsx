"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

import { accountProviderLabel } from "../lib/account-labels";
import type { AdminAccountPage } from "../types";
import {
  AdminAccountRoleBadge,
  AdminAccountStatusBadge,
} from "./AdminAccountStatusBadge";

/**
 * 회원 테이블 + 페이지네이션. 행 아무 셀을 눌러도 `?selected=<id>` 가 URL 에 붙고 부모 레벨의
 * Sheet 가 열린다 — 쿼리를 상태 저장소로 삼아 **공유 가능한 링크** 를 유지한다.
 *
 * ⚠️ `<tr>` 에 `role="button"` 을 주지 않는다. WAI-ARIA 에서 button 의 자손은 표시용으로
 *    처리돼 셀/열 제목 연결을 잃기 때문. 키보드 접근은 **이름 셀 안의 투명 버튼** 으로 열어 두고,
 *    마우스 사용자를 위한 행 전체 클릭은 `<tr>` 의 onClick 만으로 처리한다.
 */

interface AdminAccountsTableProps {
  page: AdminAccountPage;
  selectedId: number | null;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AdminAccountsTable({
  page,
  selectedId,
}: AdminAccountsTableProps) {
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

  function openDetail(accountId: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("selected", String(accountId));
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  }

  const rows = page.content;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">이름</th>
              <th className="px-4 py-2.5 text-left font-medium">이메일</th>
              <th className="px-4 py-2.5 text-left font-medium">제공자</th>
              <th className="px-4 py-2.5 text-left font-medium">역할</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
              <th className="px-4 py-2.5 text-left font-medium">가입일</th>
              <th className="px-4 py-2.5 text-left font-medium">최근 로그인</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => {
              const highlighted = row.accountId === selectedId;
              const accountId = row.accountId ?? 0;
              return (
                <tr
                  key={accountId}
                  onClick={() => openDetail(accountId)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50",
                    highlighted && "bg-slate-50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(accountId);
                      }}
                      aria-label={`${row.name} 상세 열기`}
                      className="-mx-1 rounded px-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {accountProviderLabel(row.provider)}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminAccountRoleBadge role={row.role} />
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminAccountStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {formatDate(row.lastLoginAt)}
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
                  조건에 맞는 회원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          총 <span className="font-semibold text-slate-800">{page.totalElements.toLocaleString("ko-KR")}</span> 명 · {page.page + 1} / {page.totalPages} 페이지
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
