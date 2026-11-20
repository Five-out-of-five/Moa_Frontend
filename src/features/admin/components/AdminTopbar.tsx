import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import type { Account } from "@/types/db";

/**
 * 관리자 상단 바 — 메인 사이트의 `Header` 와 다른 라인을 쓴다. 관리자 영역에서 알림/프로필
 * 메뉴를 보여 주면 "메인 사이트 쉘" 과 혼동되므로, **최소 정보만** 유지한다 — 현재 로그인한
 * 계정 뱃지 + 관리자 대시보드 바로가기.
 *
 * ⚠️ 좌측 링크는 `/admin` 이지 `/` 가 아니다. 관리자 영역 안에서 쓰는 버튼이라 "메인 사이트로
 *    나가기" 가 아니라 "대시보드로 돌아가기" 가 자연스럽다 — 메인 사이트 이동은 관리자 모드를
 *    완전히 빠져나가는 동작이므로 별도 UI 가 필요할 때 따로 추가.
 */

interface AdminTopbarProps {
  me: Pick<Account, "name" | "email">;
}

export function AdminTopbar({ me }: AdminTopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        <span>대시보드로</span>
      </Link>

      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span className="hidden text-slate-400 sm:inline">관리자</span>
        <span className="font-medium text-slate-800">{me.name}</span>
        <span className="hidden text-slate-400 md:inline">{me.email}</span>
      </div>
    </header>
  );
}
