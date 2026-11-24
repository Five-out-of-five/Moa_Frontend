"use client";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Paperclip,
  Plus,
  Scale,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MemberRef,
  RoomProgress,
  RoomWorkload,
  Sprint,
  TaskDetail,
  TaskStatus,
  TaskSummary,
  WorkloadLevel,
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
  /** 활성 방 멤버 — 업무 생성 다이얼로그의 담당자 셀렉터와 밸런서 차트에 쓴다. */
  members: readonly MemberRef[];
  /** 로그인 사용자의 accountId. 생성 시 기본 담당자로 지정. */
  meAccountId: number | null;
  /** 방의 활성 스프린트 — 헤더 뱃지·기간 표시에 쓴다. null 이면 "활성 스프린트 없음". */
  activeSprint: Sprint | null;
  /** 진척도 — `/tasks/progress` 응답. 활성 스프린트 기준 집계. null 이면 조회 실패. */
  progress: RoomProgress | null;
  /** 업무 밸런서 — `/tasks/workload` 응답. 방 전체 open 업무 기준. null 이면 조회 실패. */
  workload: RoomWorkload | null;
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

const STATUS_SUBTEXT: Record<TaskStatus, string> = {
  TODO: "시작 전 업무",
  IN_PROGRESS: "현재 작업 중",
  REVIEW: "확인이 필요한 업무",
  DONE: "마무리된 업무",
};

/**
 * 업무 보드 전체 페이지 — Figma Make "업무 보드" 화면 그대로.
 *
 * ⚠️ 레이아웃: 좌측 칸반 4컬럼 + 우측 **업무 밸런서** (멤버별 업무량). 데스크톱 넓은 폭 기준.
 *    xl 이하에선 밸런서를 세로 아래로 떨어뜨린다.
 * ⚠️ 쓰기 액션: 생성 · 상태 변경(상세 Sheet 안) · 수정 · 담당자 변경 · 반려 · 삭제. 첨부는
 *    후속 PR 범위. 스프린트 선택/종료 버튼은 명세 확정 전까지 **자리만** 비활성.
 * ⚠️ 상세는 `page.tsx` 에서 Summary 와 함께 **선패치**해 넘긴다 — 업무 수가 적은 전제에서
 *    Sheet 왕복 없이 바로 열린다. 실서버에서 업무가 수백 건 쌓이면 lazy fetch 로 전환.
 */
export function TaskBoardPageClient({
  roomId,
  roomName,
  summaries,
  details,
  members,
  meAccountId,
  activeSprint,
  progress,
  workload,
  initialOpenTaskId = null,
  unavailableTaskIds = [],
}: Props) {
  const [openTaskId, setOpenTaskId] = useState<number | null>(initialOpenTaskId);
  const [createOpen, setCreateOpen] = useState(false);
  /** "+ 추가" 버튼이 눌린 컬럼의 기본 상태. 전역 "새 업무" 버튼이면 TODO. */
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>("TODO");

  // 생성 직후 revalidate 응답이 돌아오기 전까지 UI 공백을 메우기 위해 로컬 보강 상태를
  // 둔다. props 로 들어온 서버 데이터가 바뀌면 (`revalidatePath` 완료) 그 값으로
  // 되돌려, 서버가 항상 "진짜" 가 되도록 한다.
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
    sprintId: task.sprintId,
    fileCount: task.fileCount,
  });

  const handleCreated = (task: TaskDetail) => {
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
    for (const t of localSummaries) map.get(t.status)!.push(t);
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [localSummaries]);

  const openCreateFor = (status: TaskStatus) => {
    setCreateDefaultStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {roomName}
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-bold">업무 보드</h1>
          <SprintHeadline sprint={activeSprint} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-1">
              <ArrowLeft className="size-4" />
              대시보드로 돌아가기
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="스프린트 전환은 명세 확정 뒤 후속 PR"
          >
            스프린트 선택
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => openCreateFor("TODO")}
          >
            <Plus className="size-4" />새 업무
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="스프린트 전환은 명세 확정 뒤 후속 PR"
          >
            스프린트 종료
          </Button>
        </div>
      </header>

      <SprintProgressBar progress={progress} activeSprint={activeSprint} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {TASK_STATUS_ORDER.map((status) => {
            const items = grouped.get(status) ?? [];
            return (
              <section
                key={status}
                aria-label={`${TASK_STATUS_LABEL[status]} 컬럼`}
                className="border-border-soft bg-background flex min-h-[320px] flex-col gap-2 rounded-[var(--radius-card)] border px-3 py-3"
              >
                <header className="flex items-start justify-between px-1 pb-1">
                  <div>
                    <h2
                      className={cn(
                        "inline-flex items-center gap-2 text-sm font-semibold",
                        TASK_STATUS_HEADER_CLASS[status],
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block size-2 rounded-full",
                          statusDotClass(status),
                        )}
                      />
                      {TASK_STATUS_LABEL[status]}
                      <span className="bg-muted text-muted-foreground inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium">
                        {items.length}
                      </span>
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {STATUS_SUBTEXT[status]}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${TASK_STATUS_LABEL[status]} 컬럼에 업무 추가`}
                    onClick={() => openCreateFor(status)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 items-center justify-center rounded-[var(--radius-control)] transition-colors"
                  >
                    <Plus className="size-4" />
                  </button>
                </header>
                {items.length === 0 ? (
                  <p className="text-muted-foreground/80 flex-1 px-1 py-4 text-center text-xs">
                    이 컬럼에 업무가 없어요.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((t) => (
                      <li key={t.taskId} data-briefing-id={t.taskId} className="rounded-control data-briefing-highlight:ring-primary data-briefing-highlight:ring-2">
                        <TaskCard
                          summary={t}
                          attachmentCount={
                            localDetails[t.taskId]?.files?.length ?? 0
                          }
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

        <TaskBalancer
          workload={workload}
          summaries={localSummaries}
          sprintName={activeSprint?.name ?? null}
        />
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
        defaultStatus={createDefaultStatus}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

/** 헤더 아래 보조 라인 — "진행 중" 뱃지 + 스프린트명 + 기간. */
function SprintHeadline({ sprint }: { sprint: Sprint | null }) {
  if (!sprint) {
    return (
      <p className="text-muted-foreground mt-1 text-sm">
        활성 스프린트가 없어요. 새 스프린트를 만들어 흐름을 이어 가세요.
      </p>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      <span className="bg-secondary text-brand inline-flex items-center rounded-full px-2 py-0.5 font-medium">
        진행 중
      </span>
      <span className="text-foreground font-medium">{sprint.name}</span>
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Calendar className="size-3" />
        {formatSprintRange(sprint.startsAt, sprint.endsAt)}
      </span>
    </div>
  );
}

/**
 * 스프린트 진행률 바 + 완료/전체/남은 통계 (Figma 상단 블록).
 *
 * ⚠️ 집계는 **활성 스프린트에 소속된 업무만** 세야 한다 — 보드가 보여주는 `summaries` 는
 *    방 전체 업무(과거 스프린트 포함) 라서 그걸로 세면 "비활성 스프린트 업무" 까지 진행률에
 *    섞인다 (CodeRabbit). 서버가 관리하는 `Sprint.totalTasks` / `doneTasks` 를 사용하고,
 *    이 값은 `createTask` / `updateTask` / `changeStatus` / `deleteTask` 액션에서 함께
 *    보정한다.
 */
/**
 * 스프린트 진행률 — BE `/tasks/progress` 응답으로 그린다.
 *
 * ⚠️ progress 조회가 실패(null) 하면 activeSprint 의 `totalTasks`/`doneTasks` 로 fallback —
 *    활성 스프린트 요약은 별 경로로 실패할 수 있고, 진행률이라도 노출되는 편이 사용자에게 유용.
 * ⚠️ progress.sprint 가 null 이면 "활성 스프린트 없음" 상태 — 전체 0 으로 표시.
 */
function SprintProgressBar({
  progress,
  activeSprint,
}: {
  progress: RoomProgress | null;
  activeSprint: Sprint | null;
}) {
  const total = progress?.totalCount ?? activeSprint?.totalTasks ?? 0;
  const done = progress?.doneCount ?? activeSprint?.doneTasks ?? 0;
  const remain = Math.max(0, total - done);
  const percent =
    progress?.progressRate ?? (total > 0 ? Math.round((done / total) * 100) : 0);
  const sprintName = progress?.sprint?.name ?? activeSprint?.name ?? null;
  const dueSoon = progress?.dueSoonCount ?? 0;

  return (
    <section
      aria-label="스프린트 진행률"
      className="border-border-soft bg-surface flex items-center gap-6 rounded-[var(--radius-card)] border px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {sprintName ? `${sprintName} 진행률` : "스프린트 진행률"}
          </span>
          <span className="text-foreground text-sm font-semibold">{percent}%</span>
        </div>
        <div
          className="bg-muted relative h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span
            className="bg-brand absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <Stat label="완료 업무" value={done} />
      <Stat label="전체 업무" value={total} />
      <Stat label="남은 업무" value={remain} />
      <Stat label="임박 마감" value={dueSoon} tone={dueSoon > 0 ? "warn" : "default"} />
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="shrink-0 text-center">
      <p
        className={cn(
          "text-xl font-bold leading-none",
          tone === "warn" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">{label}</p>
    </div>
  );
}

/**
 * 업무 밸런서 — BE `/tasks/workload` 응답을 멤버별 가로 바로 보여준다.
 *
 * ⚠️ workload 가 null (조회 실패) 이면 섹션을 접고 안내만 노출한다. BE score/level 을
 *    FE 가 재계산하면 공식이 어긋날 위험이 있어 fallback 집계를 두지 않는다.
 * ⚠️ 미담당 건수는 BE 응답에 없어 `summaries` 에서 DONE 제외·assignee null 로 계산한다.
 * ⚠️ 레벨 매핑: RELAXED → "여유"(light), NORMAL → "적당"(even), OVERLOADED → "많음"(heavy).
 * ⚠️ warnings 는 멤버 라인에 알림 아이콘을 띄워 "주의" 를 시각화한다.
 */
function TaskBalancer({
  workload,
  summaries,
  sprintName,
}: {
  workload: RoomWorkload | null;
  summaries: readonly TaskSummary[];
  sprintName: string | null;
}) {
  const view = useMemo(() => {
    if (!workload) return null;
    const warnBy = new Set(workload.warnings.map((w) => w.accountId));
    // 바 비율은 open 업무 수 기준 (score 가 가중치라 시각 비교에 덜 직관적).
    const max = Math.max(
      1,
      ...workload.members.map((m) => m.openTaskCount),
      unassignedCount(summaries),
    );
    const rows = workload.members.map((m) => ({
      accountId: m.accountId,
      name: m.displayName,
      count: m.openTaskCount,
      band: levelToBand(m.level),
      warned: warnBy.has(m.accountId),
      ratio: m.openTaskCount / max,
    }));
    const un = unassignedCount(summaries);
    return {
      rows,
      unassigned: { count: un, ratio: un / max },
    };
  }, [workload, summaries]);

  return (
    <aside
      aria-label="업무 밸런서"
      className="border-border-soft bg-surface flex h-fit flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
          <Scale className="size-4" />
          업무 밸런서
        </h2>
        {sprintName && (
          <span className="text-muted-foreground text-[11px]">{sprintName}</span>
        )}
      </header>
      <p className="text-muted-foreground text-xs">
        팀원의 업무량을 확인해 담당자를 균형 있게 배정하세요.
      </p>
      {view === null ? (
        <p className="text-muted-foreground text-xs">
          밸런서 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.
        </p>
      ) : (
      <ul className="flex flex-col gap-2.5">
        {view.rows.map((r) => (
          <li key={r.accountId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="bg-brand text-white flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                >
                  {r.name.slice(0, 1)}
                </span>
                {r.name}
                {r.warned && (
                  <span
                    role="img"
                    aria-label="업무 과다 주의"
                    title="업무가 과도하게 쏠려 있어요"
                    className="text-destructive text-[11px]"
                  >
                    ⚠
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {r.count} · {bandLabel(r.band)}
              </span>
            </div>
            <WorkloadBar ratio={r.ratio} band={r.band} />
          </li>
        ))}
        {view.unassigned.count > 0 && (
          <li className="flex flex-col gap-1 border-t border-border-soft pt-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full"
                >
                  <User className="size-3" />
                </span>
                미담당
              </span>
              <span className="text-muted-foreground">
                {view.unassigned.count}건
              </span>
            </div>
            <WorkloadBar ratio={view.unassigned.ratio} band="light" />
          </li>
        )}
      </ul>
      )}
      <div className="border-border-soft bg-background mt-1 flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2">
        <User aria-hidden="true" className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        <div>
          <p className="text-foreground text-xs font-medium">담당자 추천</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            업무 밸런스를 바탕으로 한 담당자 자동 추천은 준비 중이에요.
          </p>
        </div>
      </div>
    </aside>
  );
}

function WorkloadBar({
  ratio,
  band,
}: {
  ratio: number;
  band: "heavy" | "even" | "light";
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          band === "heavy" && "bg-danger",
          band === "even" && "bg-brand",
          band === "light" && "bg-success",
        )}
        style={{ width: `${Math.round(clamped * 100)}%` }}
      />
    </div>
  );
}

function bandLabel(band: "heavy" | "even" | "light"): string {
  if (band === "heavy") return "많음";
  if (band === "light") return "여유";
  return "적당";
}

/** BE WorkloadLevel → UI 밴드. OVERLOADED=heavy, NORMAL=even, RELAXED=light. */
function levelToBand(level: WorkloadLevel): "heavy" | "even" | "light" {
  if (level === "OVERLOADED") return "heavy";
  if (level === "RELAXED") return "light";
  return "even";
}

/** 담당자 없는 open 업무(DONE 제외) 수 — BE workload 응답에 포함되지 않아 Summary 로 계산. */
function unassignedCount(summaries: readonly TaskSummary[]): number {
  return summaries.filter((s) => s.status !== "DONE" && !s.assignee).length;
}

function statusDotClass(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "bg-muted-foreground";
    case "IN_PROGRESS":
      return "bg-brand";
    case "REVIEW":
      return "bg-warning";
    case "DONE":
      return "bg-success";
  }
}

/**
 * Figma 디자인의 "6월 17일-6월 28일" 포맷으로 스프린트 기간을 만든다.
 * endsAt 이 없으면 시작일만.
 */
function formatSprintRange(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  const sLabel = `${s.getMonth() + 1}월 ${s.getDate()}일`;
  if (!endsAt) return sLabel;
  const e = new Date(endsAt);
  const eLabel = `${e.getMonth() + 1}월 ${e.getDate()}일`;
  return `${sLabel} - ${eLabel}`;
}

function TaskCard({
  summary,
  attachmentCount,
  unavailable = false,
  onClick,
}: {
  summary: TaskSummary;
  attachmentCount: number;
  unavailable?: boolean;
  onClick: () => void;
}) {
  const DoneIcon = summary.status === "DONE" ? CheckCircle2 : Circle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      title={unavailable ? "상세를 불러오지 못했어요 — 페이지를 새로고침 해 주세요" : undefined}
      className={cn(
        "border-border bg-surface flex w-full flex-col gap-2 rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors",
        unavailable ? "cursor-not-allowed opacity-60" : "hover:border-brand",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
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
        {attachmentCount > 0 && (
          <span
            className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]"
            aria-label={`첨부 ${attachmentCount}개`}
          >
            <Paperclip className="size-3" />
            {attachmentCount}
          </span>
        )}
      </div>
      <p className="text-foreground inline-flex items-start gap-1.5 text-sm font-medium leading-snug">
        <DoneIcon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            summary.status === "DONE" ? "text-success" : "text-muted-foreground",
          )}
        />
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
