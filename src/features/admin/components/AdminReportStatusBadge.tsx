import { cn } from "@/lib/utils";

import { reportStatusLabel } from "../lib/report-labels";
import type { AdminReportStatus } from "../types";

/**
 * 신고 상태 뱃지. 관리자 영역 "정적 톤" 규칙에 따라 slate 중심, 주의 신호만 amber.
 *   - RECEIVED: slate-100 — 접수 대기
 *   - IN_PROGRESS: amber-50/700 — 담당자가 들여다보는 중 (경미한 강조)
 *   - RESOLVED: slate-900/white — 처리 완료 표식
 *   - REJECTED: slate-50/slate-400 — 반려(흐린 톤)
 */

interface Props {
  status: AdminReportStatus | string | undefined;
}

export function AdminReportStatusBadge({ status }: Props) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    RECEIVED: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    RESOLVED: "bg-slate-900 text-white",
    REJECTED: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
  };
  return (
    <span className={cn(base, map[status ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {reportStatusLabel(status)}
    </span>
  );
}
