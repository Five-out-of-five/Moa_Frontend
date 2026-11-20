"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  REPORT_REASON_OPTIONS,
  REPORT_STATUS_OPTIONS,
  REPORT_TARGET_TYPE_OPTIONS,
} from "../lib/report-labels";

/**
 * 신고 관리 필터 바. URL 쿼리 (`status`, `targetType`, `reason`, `page`) 를 정본으로 삼는다.
 * 검색어는 없고 셀렉트만 — 신고 데이터는 양이 적어 자유 검색이 불필요.
 *
 * ⚠️ 필터가 바뀌면 `page` 는 **0으로 리셋**.
 */

const INPUTS = [
  { name: "status", options: REPORT_STATUS_OPTIONS, placeholder: "전체 상태" },
  { name: "targetType", options: REPORT_TARGET_TYPE_OPTIONS, placeholder: "전체 대상" },
  { name: "reason", options: REPORT_REASON_OPTIONS, placeholder: "전체 사유" },
] as const;

interface AdminReportFiltersProps {
  initialStatus: string;
  initialTargetType: string;
  initialReason: string;
}

export function AdminReportFilters({
  initialStatus,
  initialTargetType,
  initialReason,
}: AdminReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateQuery(patch: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const initials: Record<string, string> = {
    status: initialStatus,
    targetType: initialTargetType,
    reason: initialReason,
  };

  const hasAny = Boolean(initialStatus || initialTargetType || initialReason);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      {INPUTS.map(({ name, options, placeholder }) => (
        <select
          key={name}
          value={initials[name]}
          onChange={(e) => updateQuery({ [name]: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          aria-label={placeholder}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {hasAny && (
        <button
          type="button"
          onClick={() =>
            updateQuery({ status: "", targetType: "", reason: "" })
          }
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
