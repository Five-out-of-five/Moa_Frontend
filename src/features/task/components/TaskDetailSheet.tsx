"use client";

import { Calendar, History, User } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { TaskDetail, TaskStatus } from "@/types/db";

import { changeTaskStatusAction } from "../actions";
import {
  formatDDay,
  TASK_HISTORY_LABEL,
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_SOURCE_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "../lib/labels";

interface Props {
  roomId: number;
  task: TaskDetail | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

/**
 * 업무 상세 Sheet — 보드에서 카드 클릭 시 우측에 열린다. 이번 범위의 쓰기 액션은
 * **상태 변경**(TODO ↔ IN_PROGRESS ↔ REVIEW ↔ DONE) 1건이고 나머지(담당자 변경·내용 수정·
 * 삭제·반려·첨부) 는 후속 PR.
 *
 * ⚠️ 명세의 `version` 을 함께 보내 **낙관적 잠금**을 건다 — 다른 사용자가 먼저 바꿨다면
 *    서버가 거절하고, FE 는 재조회 안내로 떨어뜨린다.
 */
export function TaskDetailSheet({ roomId, task, open, onOpenChange }: Props) {
  const [local, setLocal] = useState<TaskDetail | null>(task);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ⚠️ Sheet 가 업무 A → B 로 바뀔 때, A 의 뒤늦은 응답이 B 를 덮거나 B 에 A 의 에러를
  //    출력하지 않도록 generation 토큰으로 가드.
  const genRef = useRef(0);

  useEffect(() => {
    genRef.current += 1;
    setLocal(task);
    setError(null);
  }, [task]);

  const handleStatusChange = (next: TaskStatus) => {
    if (!local || pending || local.status === next) return;
    setError(null);
    const requestGen = genRef.current;
    startTransition(async () => {
      const result = await changeTaskStatusAction({
        roomId,
        taskId: local.taskId,
        status: next,
        version: local.version,
      });
      if (genRef.current !== requestGen) return;

      switch (result.kind) {
        case "ok":
          setLocal(result.task);
          return;
        case "conflict":
        case "ok_detail_stale":
        case "error":
          setError(result.message);
          return;
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-surface flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        {local ? (
          <>
            <SheetHeader className="border-border-soft gap-2 border-b px-5 py-4">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    TASK_PRIORITY_CLASS[local.priority],
                  )}
                >
                  우선순위 · {TASK_PRIORITY_LABEL[local.priority]}
                </span>
                {local.source.type !== "NONE" && (
                  <span className="bg-background text-muted-foreground inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
                    {TASK_SOURCE_LABEL[local.source.type]}
                  </span>
                )}
              </div>
              <SheetTitle className="text-foreground text-lg font-semibold leading-snug">
                {local.title}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                {local.registrant.displayName} 님이 등록 · {formatDDay(local.dDay, local.overdue)}
                {local.overdue && (
                  <span className="text-destructive ml-2 font-medium">지연</span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <section>
                <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                  상태
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {TASK_STATUS_ORDER.map((s) => {
                    const active = local.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(s)}
                        disabled={pending || active}
                        className={cn(
                          "inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "bg-brand text-white"
                            : "border-border bg-background text-muted-foreground hover:border-brand hover:text-brand border",
                          pending && "opacity-60",
                        )}
                      >
                        {TASK_STATUS_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
                {error && (
                  <p className="text-destructive mt-2 text-xs">{error}</p>
                )}
              </section>

              <section>
                <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                  담당자
                </h3>
                <div className="text-foreground flex items-center gap-2 text-sm">
                  <User className="text-muted-foreground size-4" />
                  {local.assignee
                    ? local.assignee.displayName
                    : "미담당"}
                </div>
              </section>

              <section>
                <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                  기한
                </h3>
                <div className="text-foreground flex items-center gap-2 text-sm">
                  <Calendar className="text-muted-foreground size-4" />
                  {local.dueDate ?? "기한 없음"}
                </div>
              </section>

              {local.description && (
                <section>
                  <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                    설명
                  </h3>
                  <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {local.description}
                  </p>
                </section>
              )}

              <section>
                <h3 className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium">
                  <History className="size-3.5" />
                  변경 이력
                </h3>
                <ul className="border-border-soft flex flex-col gap-2 border-l pl-3">
                  {local.history.map((h, i) => (
                    <li key={i} className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">
                        {TASK_HISTORY_LABEL[h.historyType]}
                      </span>
                      {h.fromStatus && h.toStatus && (
                        <span className="ml-1">
                          · {TASK_STATUS_LABEL[h.fromStatus]} →{" "}
                          {TASK_STATUS_LABEL[h.toStatus]}
                        </span>
                      )}
                      <span className="ml-1">
                        · {h.actor.displayName} · {formatHistoryTime(h.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="border-border-soft bg-background border-t px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled
                title="업무 수정 · 담당자 변경 · 삭제는 후속 작업에서 추가됩니다"
              >
                수정 · 담당자 변경 (후속 PR)
              </Button>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-10 text-sm">
            업무 정보를 불러오지 못했습니다.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}
