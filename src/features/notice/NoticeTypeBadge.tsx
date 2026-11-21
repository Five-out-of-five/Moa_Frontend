import { cn } from "@/lib/utils";

import { NOTICE_LABELS, type NoticeSummary } from "./model";

export function NoticeTypeBadge({ type }: { type?: NoticeSummary["noticeType"] }) {
  return <span className={cn(
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold",
    type === "URGENT" ? "bg-destructive/10 text-destructive"
      : type === "MAINTENANCE" ? "border-warning/30 bg-warning/10 border text-foreground"
        : "bg-secondary text-secondary-foreground",
  )}>{type ? NOTICE_LABELS[type] : "공지"}</span>;
}
