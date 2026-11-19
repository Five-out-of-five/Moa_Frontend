"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  PROVIDER_OPTIONS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
} from "../lib/account-labels";

/**
 * 회원 관리 필터 바. URL 쿼리 (`keyword`, `role`, `status`, `provider`, `page`) 를 정본으로
 * 삼아 공유 가능한 뷰 상태로 둔다. 검색어만 디바운스 처리.
 *
 * ⚠️ 필터가 바뀌면 `page` 는 **0으로 리셋** 한다 — 현재 페이지에 결과가 없을 때 빈 테이블만
 *    띄우는 사고 방지.
 */

const INPUTS = [
  { name: "role", options: ROLE_OPTIONS, placeholder: "전체 역할" },
  { name: "status", options: STATUS_OPTIONS, placeholder: "전체 상태" },
  { name: "provider", options: PROVIDER_OPTIONS, placeholder: "전체 제공자" },
] as const;

interface AdminAccountFiltersProps {
  initialKeyword: string;
  initialRole: string;
  initialStatus: string;
  initialProvider: string;
}

export function AdminAccountFilters({
  initialKeyword,
  initialRole,
  initialStatus,
  initialProvider,
}: AdminAccountFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [, startTransition] = useTransition();

  // 디바운스: 입력 멈춘 뒤 350ms 후 반영.
  useEffect(() => {
    if (keyword === initialKeyword) return;
    const t = setTimeout(() => {
      updateQuery({ keyword });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

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
    role: initialRole,
    status: initialStatus,
    provider: initialProvider,
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <label className="relative flex-1 min-w-[220px]">
        <span className="sr-only">이름 또는 이메일 검색</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          className="w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </label>

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

      {(initialKeyword || initialRole || initialStatus || initialProvider) && (
        <button
          type="button"
          onClick={() => {
            setKeyword("");
            updateQuery({
              keyword: "",
              role: "",
              status: "",
              provider: "",
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
