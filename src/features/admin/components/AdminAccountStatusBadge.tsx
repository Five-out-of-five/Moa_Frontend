import { cn } from "@/lib/utils";

import { accountRoleLabel, accountStatusLabel } from "../lib/account-labels";
import type { AdminAccountRole, AdminAccountStatus } from "../types";

/**
 * 관리자 영역 전용 상태/역할 뱃지. "컬러풀 X · 정적 톤" 규칙에 맞춰 색 사용을 최소화.
 *   - 정상(ACTIVE): 연한 slate
 *   - 정지(SUSPENDED): amber (운영상 주의가 필요한 신호)
 *   - 탈퇴(WITHDRAWN): slate-200 + 취소선 없이 흐린 톤
 *   - 관리자 역할: slate-900 (운영자 표식)
 */

interface StatusBadgeProps {
  status: AdminAccountStatus | string | undefined;
}

export function AdminAccountStatusBadge({ status }: StatusBadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    ACTIVE: "bg-slate-100 text-slate-700",
    SUSPENDED: "bg-amber-100 text-amber-800",
    WITHDRAWN: "bg-slate-50 text-slate-400",
  };
  return (
    <span className={cn(base, map[status ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {accountStatusLabel(status)}
    </span>
  );
}

interface RoleBadgeProps {
  role: AdminAccountRole | string | undefined;
}

export function AdminAccountRoleBadge({ role }: RoleBadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    ADMIN: "bg-slate-900 text-white",
    USER: "bg-white text-slate-600 ring-1 ring-slate-200",
  };
  return (
    <span className={cn(base, map[role ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {accountRoleLabel(role)}
    </span>
  );
}
