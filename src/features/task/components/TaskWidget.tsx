import { ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/types/db";

import {
  formatDDay,
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
} from "../lib/labels";

interface Props {
  roomId: number;
  /** 대시보드 위젯은 담당자가 "나" 인 업무 혹은 우선순위 높은 업무 몇 개를 보여 준다. */
  summaries: readonly TaskSummary[];
  emptyMessage?: string;
}

/**
 * 대시보드용 **업무 보드 압축 위젯** — 진행 중/할 일 중에서 상위 5건을 요약한다.
 *
 * ⚠️ 위젯은 standalone 으로 두고 대시보드 뼈대가 들어올 때 import 한다 — 이번 PR 범위에선
 *    어느 페이지에도 올리지 않는다.
 */
export function TaskWidget({ roomId, summaries, emptyMessage }: Props) {
  const openOnly = summaries.filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
  );
  const sorted = [...openOnly].sort((a, b) => {
    // 지연된 것 먼저, 그 다음 우선순위(HIGH > NORMAL > LOW), 그 다음 dDay 오름차순
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const rank: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
    if (rank[a.priority] !== rank[b.priority]) {
      return rank[a.priority]! - rank[b.priority]!;
    }
    return (a.dDay ?? 999) - (b.dDay ?? 999);
  });
  const shown = sorted.slice(0, 5);

  return (
    <section
      aria-label="업무 보드 위젯"
      className="border-border-soft bg-surface flex min-h-[260px] flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="text-brand size-4" />
          업무 보드
        </h2>
        <Link
          href={`/rooms/${roomId}/boards/task`}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          전체 보기
        </Link>
      </header>

      {shown.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center text-center text-xs">
          {emptyMessage ?? "열린 업무가 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((t) => (
            <li key={t.taskId}>
              <Link
                href={`/rooms/${roomId}/boards/task`}
                className="hover:bg-secondary flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors"
              >
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    TASK_PRIORITY_CLASS[t.priority],
                  )}
                >
                  {TASK_PRIORITY_LABEL[t.priority]}
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                  {t.title}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground shrink-0 text-xs",
                    t.overdue && "text-destructive font-medium",
                  )}
                >
                  {formatDDay(t.dDay, t.overdue)}
                </span>
                <span className="text-muted-foreground/80 shrink-0 text-[10px]">
                  {TASK_STATUS_LABEL[t.status]}
                </span>
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
