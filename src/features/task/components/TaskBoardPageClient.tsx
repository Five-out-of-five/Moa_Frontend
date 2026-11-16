"use client";

import { ArrowLeft, Calendar, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MemberRef,
  Sprint,
  TaskDetail,
  TaskStatus,
  TaskSummary,
} from "@/types/db";

import {
  formatDDay,
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_HEADER_CLASS,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "../lib/labels";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";

interface Props {
  roomId: number;
  roomName: string;
  summaries: readonly TaskSummary[];
  details: Readonly<Record<number, TaskDetail>>;
  /** 활성 방 멤버 — 업무 생성 다이얼로그의 담당자 셀렉터에 쓴다. */
  members: readonly MemberRef[];
  /** 로그인 사용자의 accountId. 생성 시 기본 담당자로 지정. */
  meAccountId: number | null;
  /**
   * 방의 활성 스프린트 — Figma Make 디자인의 스프린트 셀렉터에 노출. null 이면
   * "활성 스프린트 없음" 비활성 상태로 보여 준다.
   */
  activeSprint: Sprint | null;
  /**
   * URL `?open={taskId}` 로 들어왔을 때 자동으로 열 업무 — 알림 클릭 등 외부 진입 경로.
   * 같은 라우트에서 쿼리만 바뀌어도 다시 반영된다.
   */
  initialOpenTaskId?: number | null;
  /**
   * 상세 fetch 가 실패해 details 에 포함되지 못한 taskId 목록. 카드에 "불러오기 실패"
   * 뱃지를 노출하고, 사용자가 **페이지 새로고침으로 재조회** 할 수 있음을 안내한다.
   */
  unavailableTaskIds?: readonly number[];
}

/**
 * 업무 보드 전체 페이지 — **칸반 4컬럼** (할 일 / 진행 중 / 리뷰 / 완료) + 상세 Sheet.
 *
 * ⚠️ 상세는 `page.tsx` 에서 Summary 와 함께 **선패치**해 넘긴다. 업무 수가 적은 전제에서
 *    Sheet 왕복 없이 바로 열린다. 실서버에서 업무가 수백 건 쌓이면 lazy fetch (Server
 *    Action) 로 전환하면 된다.
 * ⚠️ 쓰기 액션: 생성 · 상태 변경(상세 Sheet 안) · 수정 · 담당자 변경 · 반려 · 삭제. 첨부는
 *    후속 PR 범위.
 */
export function TaskBoardPageClient({
  roomId,
  roomName,
  summaries,
  details,
  members,
  meAccountId,
  activeSprint,
  initialOpenTaskId = null,
  unavailableTaskIds = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<number | null>(initialOpenTaskId);
  const [createOpen, setCreateOpen] = useState(false);

  // 생성 직후 revalidate 응답이 돌아오기 전까지 UI 공백을 메우기 위해 로컬 보강 상태를
  // 둔다 (투표 생성과 동일 패턴). props 로 들어온 서버 데이터가 바뀌면 (`revalidatePath`
  // 완료) 그 값으로 되돌려, 서버가 항상 "진짜" 가 되도록 한다.
  const [localSummaries, setLocalSummaries] = useState(summaries);
  const [localDetails, setLocalDetails] = useState(details);
  useEffect(() => setLocalSummaries(summaries), [summaries]);
  useEffect(() => setLocalDetails(details), [details]);

  const unavailableSet = useMemo(
    () => new Set(unavailableTaskIds),
    [unavailableTaskIds],
  );
  const detail: TaskDetail | null =
    openTaskId !== null ? (localDetails[openTaskId] ?? null) : null;

  // URL `?open=` 값이 바뀌면 Sheet 를 다시 연다 (알림 두 번째 클릭 등).
  useEffect(() => {
    if (initialOpenTaskId !== null) setOpenTaskId(initialOpenTaskId);
  }, [initialOpenTaskId]);

  const visible = useMemo(() => {
    let list = localSummaries;
    if (onlyMine) list = list.filter((t) => t.assignee !== null);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    return list;
  }, [localSummaries, onlyMine, query]);

  const toSummary = (task: TaskDetail): TaskSummary => ({
    taskId: task.taskId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    dDay: task.dDay,
    overdue: task.overdue,
    sortOrder: task.sortOrder,
    version: task.version,
    registrant: task.registrant,
    assignee: task.assignee,
    source: task.source,
  });

  const handleCreated = (task: TaskDetail) => {
    // 서버 리런 전까지 신규 상세·요약을 바로 보여 주고 상세 Sheet 도 자동으로 열어 준다.
    setLocalDetails((prev) => ({ ...prev, [task.taskId]: task }));
    setLocalSummaries((prev) => [...prev, toSummary(task)]);
    setOpenTaskId(task.taskId);
  };

  const handleTaskUpdated = (task: TaskDetail) => {
    setLocalDetails((prev) => ({ ...prev, [task.taskId]: task }));
    setLocalSummaries((prev) =>
      prev.map((s) => (s.taskId === task.taskId ? toSummary(task) : s)),
    );
  };

  const handleTaskDeleted = (taskId: number) => {
    setLocalDetails((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setLocalSummaries((prev) => prev.filter((s) => s.taskId !== taskId));
    setOpenTaskId((prev) => (prev === taskId ? null : prev));
  };

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, TaskSummary[]>();
    for (const status of TASK_STATUS_ORDER) map.set(status, []);
    for (const t of visible) map.get(t.status)!.push(t);
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [visible]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {roomName}
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-bold">업무 보드</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            스프린트 안의 업무를 상태별로 모아 보고, 상세에서 흐름을 이어 가세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link href={`/rooms/${roomId}`} className="flex items-center gap-1">
              <ArrowLeft className="size-4" />
              대시보드로 돌아가기
            </Link>
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />새 업무
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="border-border rounded"
          />
          <span className="text-muted-foreground">담당자 있는 업무만</span>
        </label>
        <label className="relative max-w-xs flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="업무 제목 검색"
            aria-label="업무 검색"
            className="border-border bg-background focus:ring-ring h-9 w-full rounded-[var(--radius-control)] border py-1 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUS_ORDER.map((status) => {
          const items = grouped.get(status) ?? [];
          return (
            <section
              key={status}
              aria-label={`${TASK_STATUS_LABEL[status]} 컬럼`}
              className="border-border-soft bg-background flex min-h-[320px] flex-col gap-2 rounded-[var(--radius-card)] border px-3 py-3"
            >
              <header className="flex items-center justify-between px-1">
                <h2
                  className={cn(
                    "inline-flex items-center gap-2 text-sm font-semibold",
                    TASK_STATUS_HEADER_CLASS[status],
                  )}
                >
                  {TASK_STATUS_LABEL[status]}
                  <span className="bg-muted text-muted-foreground inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium">
                    {items.length}
                  </span>
                </h2>
              </header>
              {items.length === 0 ? (
                <p className="text-muted-foreground/80 flex-1 px-1 py-4 text-center text-xs">
                  이 컬럼에 업무가 없어요.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((t) => (
                    <li key={t.taskId}>
                      <TaskCard
                        summary={t}
                        unavailable={unavailableSet.has(t.taskId)}
                        onClick={() => setOpenTaskId(t.taskId)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <TaskDetailSheet
        roomId={roomId}
        task={detail}
        members={members}
        meAccountId={meAccountId}
        open={openTaskId !== null}
        onOpenChange={(o) => {
          if (!o) setOpenTaskId(null);
        }}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />

      <TaskCreateDialog
        roomId={roomId}
        members={members}
        defaultAssigneeAccountId={meAccountId}
        activeSprint={activeSprint}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

function TaskCard({
  summary,
  unavailable = false,
  onClick,
}: {
  summary: TaskSummary;
  unavailable?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      title={unavailable ? "상세를 불러오지 못했어요 — 페이지를 새로고침 해 주세요" : undefined}
      className={cn(
        "border-border bg-surface flex w-full flex-col gap-2 rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors",
        unavailable
          ? "cursor-not-allowed opacity-60"
          : "hover:border-brand",
      )}
    >
      <div className="flex items-center gap-1.5">
        {unavailable && (
          <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            불러오기 실패
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            TASK_PRIORITY_CLASS[summary.priority],
          )}
        >
          {TASK_PRIORITY_LABEL[summary.priority]}
        </span>
        {summary.source.type !== "NONE" && (
          <span className="bg-background text-muted-foreground inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
            {summary.source.type === "CARD" ? "카드" : "투표"}
          </span>
        )}
        {summary.overdue && (
          <span className="bg-danger/10 text-danger inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            지연
          </span>
        )}
      </div>
      <p className="text-foreground text-sm font-medium leading-snug">
        {summary.title}
      </p>
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1">
          <User className="size-3" />
          {summary.assignee ? summary.assignee.displayName : "미담당"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3" />
          {formatDDay(summary.dDay, summary.overdue)}
        </span>
      </div>
    </button>
  );
}
