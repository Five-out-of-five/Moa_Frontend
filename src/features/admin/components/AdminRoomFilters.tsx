"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  ROOM_INACTIVE_DAYS_OPTIONS,
  ROOM_SORT_OPTIONS,
  ROOM_STATUS_OPTIONS,
} from "../lib/room-labels";

/**
 * 방 관리 필터 — 검색(디바운스) + 상태 셀렉트 + 비활성 일수 셀렉트 + 정렬 셀렉트.
 * URL 쿼리를 정본, `queryStringRef` 로 연속 셀렉트 변경 누적 (다른 관리자 화면들과 동일 패턴).
 */

interface Props {
  initialKeyword: string;
  initialStatus: string;
  initialInactiveDays: string;
  initialSort: string;
}

export function AdminRoomFilters({
  initialKeyword,
  initialStatus,
  initialInactiveDays,
  initialSort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [, startTransition] = useTransition();

  const queryStringRef = useRef(searchParams.toString());
  useEffect(() => {
    queryStringRef.current = searchParams.toString();
  }, [searchParams]);

  const expectingKeywordRef = useRef<string | null>(null);
  useEffect(() => {
    if (expectingKeywordRef.current === initialKeyword) {
      expectingKeywordRef.current = null;
      return;
    }
    setKeyword(initialKeyword);
  }, [initialKeyword]);

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

  useEffect(() => {
    if (keyword === initialKeyword) return;
    const t = setTimeout(() => {
      expectingKeywordRef.current = keyword;
      writeQuery({ keyword });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, initialKeyword]);

  const hasAny = Boolean(
    initialKeyword || initialStatus || initialInactiveDays || initialSort,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <label className="relative flex-1 min-w-[220px]">
        <span className="sr-only">방 이름 검색</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="방 이름으로 검색"
          className="w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </label>

      <select
        value={initialStatus}
        onChange={(e) => writeQuery({ status: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        aria-label="상태"
      >
        <option value="">전체 상태</option>
        {ROOM_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={initialInactiveDays}
        onChange={(e) => writeQuery({ inactiveDays: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        aria-label="비활성 기간"
      >
        <option value="">활동 전체</option>
        {ROOM_INACTIVE_DAYS_OPTIONS.map((o) => (
          <option key={o.value} value={String(o.value)}>
            {o.label} 미활동
          </option>
        ))}
      </select>

      <select
        // URL 에 sort 가 없으면 빈 문자열이 들어오는데 셀렉트는 그걸 매칭하지 못해 "최근 활동 순"
        // 을 띄우지만 서버는 BE 기본값과 같은 CREATED 로 정렬한다. 보이는 값과 결과를
        // 맞추기 위해 매칭 토큰이 없으면 CREATED 로 표시한다. `hasAny` 는 원본 initialSort 로
        // 판단해야 "필터 초기화" 버튼 노출 조건이 바뀌지 않는다.
        value={
          ROOM_SORT_OPTIONS.some((o) => o.value === initialSort)
            ? initialSort
            : "CREATED"
        }
        onChange={(e) => writeQuery({ sort: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        aria-label="정렬"
      >
        {ROOM_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setKeyword("");
            writeQuery({
              keyword: "",
              status: "",
              inactiveDays: "",
              sort: "",
            });
          }}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
