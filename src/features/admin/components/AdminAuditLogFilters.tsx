"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  AUDIT_ACTION_TYPE_SUGGESTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
} from "../lib/audit-log-labels";

/**
 * 감사 로그 필터 — 날짜 범위 + actionType 자유 입력(datalist) + targetType 드롭다운.
 * URL 쿼리 (`from`, `to`, `actionType`, `targetType`) 가 정본. 필터 변경 시 `page` 리셋.
 *
 * ⚠️ 연속 변경이 서로 덮지 않도록 `queryStringRef` 로 가장 최근 쿼리를 누적 — 신고 관리와 같은
 *    패턴.
 */

interface Props {
  initialFrom: string;
  initialTo: string;
  initialActionType: string;
  initialTargetType: string;
}

export function AdminAuditLogFilters({
  initialFrom,
  initialTo,
  initialActionType,
  initialTargetType,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [actionType, setActionType] = useState(initialActionType);
  const [, startTransition] = useTransition();

  const queryStringRef = useRef(searchParams.toString());
  useEffect(() => {
    queryStringRef.current = searchParams.toString();
  }, [searchParams]);

  // URL 쪽 actionType 이 외부 변경으로 바뀌면 입력창도 동기화. 내가 debounce 로 submit 한
  // 결과로 돌아온 경우는 skip (expecting 비교).
  const expectingActionTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (expectingActionTypeRef.current === initialActionType) {
      expectingActionTypeRef.current = null;
      return;
    }
    setActionType(initialActionType);
  }, [initialActionType]);

  function writeQuery(patch: Record<string, string>) {
    const next = new URLSearchParams(queryStringRef.current);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    queryStringRef.current = next.toString();
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // actionType 은 디바운스 (350ms).
  useEffect(() => {
    if (actionType === initialActionType) return;
    const t = setTimeout(() => {
      expectingActionTypeRef.current = actionType;
      writeQuery({ actionType });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, initialActionType]);

  const hasAny = Boolean(
    initialFrom || initialTo || initialActionType || initialTargetType,
  );

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">시작일</span>
        <input
          type="date"
          value={initialFrom}
          onChange={(e) => writeQuery({ from: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          aria-label="조회 시작일"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">종료일</span>
        <input
          type="date"
          value={initialTo}
          onChange={(e) => writeQuery({ to: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          aria-label="조회 종료일"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">대상 유형</span>
        <select
          value={initialTargetType}
          onChange={(e) => writeQuery({ targetType: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          aria-label="대상 유형"
        >
          <option value="">전체 대상</option>
          {AUDIT_TARGET_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 min-w-[180px]">
        <span className="text-[11px] font-medium text-slate-500">액션 유형</span>
        <input
          type="search"
          list="audit-action-types"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          placeholder="예: ACCOUNT_ROLE_CHANGE"
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <datalist id="audit-action-types">
          {AUDIT_ACTION_TYPE_SUGGESTIONS.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setActionType("");
            writeQuery({
              from: "",
              to: "",
              actionType: "",
              targetType: "",
            });
          }}
          className="self-end rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
