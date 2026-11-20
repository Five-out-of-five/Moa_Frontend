"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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

  // searchParams 는 자주 바뀌므로 effect 의존성에 직접 넣으면 타이머가 매번 리셋돼 디바운스가
  // 깨진다. ref 로 최신 값을 참조해 **타이머 콜백에서 현재 URL 조건을 읽도록** 한다. 이렇게
  // 두면 "검색어 치는 중에 역할 셀렉트를 바꿔도" 그 역할이 사라지지 않는다.
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // 디바운스 submit 때 "곧 initialKeyword 로 돌아올 것으로 기대하는 값" 을 남겨 두고, 그대로
  // 돌아온 initialKeyword 변화는 외부 변경이 아니라 "내가 방금 쓴 결과" 로 보고 로컬 상태를
  // 덮지 않는다. 그렇지 않으면 사용자가 submit 직후에 글자를 더 쳐도 URL 왕복 과정에서 그
  // 입력이 사라진다.
  const expectingInitRef = useRef<string | null>(null);

  // 디바운스: 입력 멈춘 뒤 350ms 후 반영.
  useEffect(() => {
    if (keyword === initialKeyword) return;
    const t = setTimeout(() => {
      expectingInitRef.current = keyword;
      const sp = searchParamsRef.current;
      const next = new URLSearchParams(sp.toString());
      if (keyword) next.set("keyword", keyword);
      else next.delete("keyword");
      next.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    }, 350);
    return () => clearTimeout(t);
  }, [keyword, initialKeyword, pathname, router]);

  // URL 쪽 keyword 가 외부에서 바뀌면 (뒤로가기 / 앞으로가기 / 다른 UI 가 쿼리를 바꿈) 입력창도
  // 그 값으로 동기화. 내가 debounce 로 submit 한 결과로 돌아온 경우는 skip.
  useEffect(() => {
    if (expectingInitRef.current === initialKeyword) {
      expectingInitRef.current = null;
      return;
    }
    setKeyword(initialKeyword);
  }, [initialKeyword]);

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
