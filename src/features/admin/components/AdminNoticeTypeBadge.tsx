import { cn } from "@/lib/utils";

import { noticeStateLabel, noticeTypeLabel } from "../lib/notice-labels";
import type { AdminNoticeType } from "../types";

/**
 * 공지 유형/상태 뱃지. "컬러풀 X · 정적 톤" 규칙에 맞춰 색 사용 최소화.
 *   - 일반(GENERAL): 연한 slate
 *   - 점검(MAINTENANCE): slate ring (정보성)
 *   - 긴급(URGENT): amber (주의)
 *   - 상태 ACTIVE: slate-900/white, SCHEDULED: slate-100, ENDED: slate-50/400
 */

interface TypeProps {
  type: AdminNoticeType | string | undefined;
}

export function AdminNoticeTypeBadge({ type }: TypeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    GENERAL: "bg-slate-100 text-slate-700",
    MAINTENANCE: "bg-white text-slate-700 ring-1 ring-slate-300",
    URGENT: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={cn(base, map[type ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {noticeTypeLabel(type)}
    </span>
  );
}

interface StateProps {
  state: string | undefined;
}

export function AdminNoticeStateBadge({ state }: StateProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    ACTIVE: "bg-slate-900 text-white",
    SCHEDULED: "bg-slate-100 text-slate-700",
    ENDED: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
  };
  return (
    <span className={cn(base, map[state ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {noticeStateLabel(state)}
    </span>
  );
}
