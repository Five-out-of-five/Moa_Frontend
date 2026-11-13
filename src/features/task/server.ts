import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { tasks } from "@/mocks/db";
import type { TaskDetail, TaskSummary } from "@/types/db";

import { computeDDay, computeOverdue } from "./lib/d-day";

function stripRoomAndSprint(
  t: TaskDetail & { roomId: number; sprintId: number | null },
): TaskDetail {
  const { roomId: _room, sprintId: _sprint, ...detail } = t;
  void _room;
  void _sprint;
  return detail;
}

/**
 * **읽을 때마다 `dDay`·`overdue` 를 재계산** 한다. 목 저장소는 모듈 초기화 1번만
 * 실행되므로 그때 계산한 값은 시간이 흐르면 stale 해진다 (CodeRabbit). 서버가 실제로
 * 내려주는 BE 응답은 요청 시점에 계산되는 값이므로, 목 쪽도 reader 에서 재계산해
 * 동일한 동작을 흉내 낸다.
 */
function withFreshDDay<T extends TaskSummary>(t: T): T {
  const dDay = computeDDay(t.dueDate);
  const overdue = computeOverdue(t.dueDate, t.status);
  return { ...t, dDay, overdue };
}

function toSummary(t: TaskDetail): TaskSummary {
  return {
    taskId: t.taskId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    dDay: t.dDay,
    overdue: t.overdue,
    sortOrder: t.sortOrder,
    version: t.version,
    registrant: t.registrant,
    assignee: t.assignee,
    source: t.source,
  };
}

/**
 * 방 안의 업무 목록 — 명세 `GET /api/v1/rooms/{roomId}/tasks`, `TaskSummaryResponse[]`.
 *
 * ⚠️ 명세는 `PageResponse` 가 아닌 **배열** 로 돌려준다 — 칸반 보드가 모든 상태의 업무를
 *    한 번에 그려야 하기 때문. 페이지네이션 대신 필터(쿼리) 는 있을 수 있지만 이번 범위에선
 *    쿼리 분기 없이 전부 받는다.
 * ⚠️ 목에선 Detail 풀 shape 로 깔아 두고 여기서 Summary 로 축소한다.
 */
export async function listTasksInRoom(roomId: number): Promise<TaskSummary[]> {
  if (isMock) {
    return tasks
      .filter((t) => t.roomId === roomId)
      .map((t) => withFreshDDay(toSummary(stripRoomAndSprint(t))));
  }
  const list = await api<TaskSummary[]>(`/api/v1/rooms/${roomId}/tasks`);
  return list.map(withFreshDDay);
}

/** 업무 상세 조회 — 명세 `GET /api/v1/rooms/{roomId}/tasks/{taskId}`. */
export async function getTaskDetail(
  roomId: number,
  taskId: number,
): Promise<TaskDetail | null> {
  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    return t ? withFreshDDay(stripRoomAndSprint(t)) : null;
  }
  const detail = await api<TaskDetail>(
    `/api/v1/rooms/${roomId}/tasks/${taskId}`,
  );
  return withFreshDDay(detail);
}
