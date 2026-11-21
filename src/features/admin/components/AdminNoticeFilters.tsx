"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import {
  NOTICE_STATE_OPTIONS,
  NOTICE_TYPE_OPTIONS,
} from "../lib/notice-labels";

/**
 * 공지 관리 필터. URL 쿼리 (`noticeType`, `state`, `page`) 를 정본으로. 필터 변경 시 `page` 리셋.
 * `queryStringRef` 로 연속 셀렉트 변경이 서로 덮어쓰지 않도록 (다른 관리자 화면들과 같은 패턴).
 */

const INPUTS = [
  { name: "noticeType", options: NOTICE_TYPE_OPTIONS, placeholder: "전체 유형" },
  { name: "state", options: NOTICE_STATE_OPTIONS, placeholder: "전체 상태" },
] as const;

interface Props {
  initialNoticeType: string;
  initialState: string;
  /** "신규 공지" 버튼 트리거 — 상위 Sheet 열기용. prop 로 받아 Filters 가 Dialog 소유 X. */
  onCreate: () => void;
}

export function AdminNoticeFilters({
  initialNoticeType,
  initialState,
  onCreate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const queryStringRef = useRef(searchParams.toString());
  useEffect(() => {
    queryStringRef.current = searchParams.toString();
  }, [searchParams]);

  function updateQuery(patch: Record<string, string>) {
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

  const initials: Record<string, string> = {
    noticeType: initialNoticeType,
    state: initialState,
  };
  const hasAny = Boolean(initialNoticeType || initialState);

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
          onClick={() => updateQuery({ noticeType: "", state: "" })}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}

      <button
        type="button"
        onClick={onCreate}
        className="ml-auto inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
      >
        신규 공지
      </button>
    </div>
  );
}
