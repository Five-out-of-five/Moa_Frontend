import { Circle, Clock3 } from "lucide-react";
import { cache } from "react";

import { computeDDay } from "@/features/task/lib/d-day";
import { getActiveSprint, listTasksInRoom } from "@/features/task/server";
import type { Sprint } from "@/types/db";

import { formatWidgetDate, ProgressBar, WidgetEmpty } from "./SummaryUi";

const getSprint = cache(getActiveSprint);
const STATUS = [
  { key: "TODO", label: "할 일", color: "text-muted-foreground" },
  { key: "IN_PROGRESS", label: "진행 중", color: "text-primary" },
  { key: "REVIEW", label: "검토", color: "text-warning" },
  { key: "DONE", label: "완료", color: "text-success" },
] as const;

function SprintBar({ sprint, showName = false }: { sprint: Sprint; showName?: boolean }) {
  const percent = sprint.totalTasks ? Math.round(sprint.doneTasks / sprint.totalTasks * 100) : 0;
  const days = sprint.endsAt ? computeDDay(sprint.endsAt.slice(0, 10)) : null;
  return (
    <div className="bg-secondary/55 rounded-control space-y-1.5 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
        <span className="font-medium">{showName ? sprint.name : "스프린트 진행률"}</span>
        <span className="text-primary font-bold tabular-nums">{percent}%</span>
      </div>
      <ProgressBar value={percent} />
      <div data-preview-extra="sprint-date" className="text-muted-foreground flex flex-wrap justify-between gap-1 text-xs">
        <span>{formatWidgetDate(sprint.startsAt)}{sprint.endsAt && ` ~ ${formatWidgetDate(sprint.endsAt)}`}</span>
        {days !== null && days >= 0 && (
          <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3" />{days ? `${days}일 남음` : "오늘 마감"}</span>
        )}
      </div>
    </div>
  );
}

export async function TaskBoardSummary({ roomId }: { roomId: number }) {
  const [tasks, sprint] = await Promise.all([listTasksInRoom(roomId), getSprint(roomId)]);
  const recent = [...tasks].sort((a, b) => b.taskId - a.taskId).slice(0, 3);
  return (
    <div className="space-y-3">
      {sprint && <SprintBar sprint={sprint} />}
      {tasks.length === 0 ? <WidgetEmpty>등록된 업무가 없어요.</WidgetEmpty> : (
        <>
          <dl className="grid grid-cols-2 gap-1.5 @xs:grid-cols-4">
            {STATUS.map(({ key, label, color }) => (
              <div key={key} className="border-border rounded-control flex flex-col-reverse border px-2 py-1.5">
                <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                  <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full bg-current ${color}`} />{label}
                </dt>
                <dd className="text-sm font-semibold tabular-nums">{tasks.filter(({ status }) => status === key).length}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-muted-foreground mb-1 text-xs">최근 업무</p>
            <ul className="divide-border divide-y">
              {recent.map((task, index) => (
                <li key={task.taskId} data-preview-extra={index > 0 ? "list-row" : undefined} className="flex items-center gap-2 py-1.5 text-xs">
                  <Circle aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />
                  <span title={task.title} className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                  <span className="text-muted-foreground max-w-20 truncate">{task.assignee?.displayName ?? "미담당"}</span>
                  {task.dueDate && <time dateTime={task.dueDate} className="text-muted-foreground shrink-0">{formatWidgetDate(task.dueDate)}</time>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export async function SprintSummary({ roomId }: { roomId: number }) {
  const sprint = await getSprint(roomId);
  if (!sprint) return <WidgetEmpty>진행 중인 스프린트가 없어요.</WidgetEmpty>;
  return (
    <div className="space-y-1.5">
      <SprintBar sprint={sprint} showName />
      <dl className="divide-border grid grid-cols-3 divide-x text-center">
        {[["전체 업무", sprint.totalTasks], ["완료", sprint.doneTasks], ["미완료", sprint.totalTasks - sprint.doneTasks]].map(([label, count]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-primary text-sm font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
