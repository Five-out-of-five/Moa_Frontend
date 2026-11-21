import { cn } from "@/lib/utils";

import { roomStatusLabel } from "../lib/room-labels";
import type { AdminRoomStatus } from "../types";

interface Props {
  status: AdminRoomStatus | string | undefined;
}

/** 방 상태 뱃지 — 정상 slate / 비활성 amber (주의 톤). */
export function AdminRoomStatusBadge({ status }: Props) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const map: Record<string, string> = {
    ACTIVE: "bg-slate-100 text-slate-700",
    INACTIVE: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={cn(base, map[status ?? ""] ?? "bg-slate-100 text-slate-500")}>
      {roomStatusLabel(status)}
    </span>
  );
}
