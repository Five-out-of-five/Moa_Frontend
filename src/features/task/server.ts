import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { sprints, tasks } from "@/mocks/db";
import type { Sprint, Task } from "@/types/db";

/** 방의 진행 중 스프린트. 없으면 null (진척도 기준 기간 없음을 의미). */
export async function getActiveSprint(roomId: number): Promise<Sprint | null> {
  if (isMock) {
    return sprints.find((s) => s.roomId === roomId && s.state === "ACTIVE") ?? null;
  }
  return api<Sprint | null>(`/api/v1/rooms/${roomId}/sprints/active`);
}

/** 업무 목록 — TODO/IN_PROGRESS/REVIEW/DONE 별 분리해 소비. */
export async function listTasks(roomId: number): Promise<Task[]> {
  if (isMock) return tasks.filter((t) => t.roomId === roomId);
  return api<Task[]>(`/api/v1/rooms/${roomId}/tasks`);
}

/** 진척도 집계 — Progress 위젯이 부른다. */
export async function getProgress(roomId: number) {
  if (isMock) {
    const sprint = sprints.find((s) => s.roomId === roomId && s.state === "ACTIVE");
    if (!sprint) return { total: 0, done: 0, percent: 0 };
    return {
      total: sprint.totalTasks,
      done: sprint.doneTasks,
      percent: sprint.totalTasks
        ? Math.round((sprint.doneTasks / sprint.totalTasks) * 100)
        : 0,
    };
  }
  return api<{ total: number; done: number; percent: number }>(
    `/api/v1/rooms/${roomId}/tasks/progress`,
  );
}
