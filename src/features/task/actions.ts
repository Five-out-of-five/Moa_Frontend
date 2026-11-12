"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { tasks } from "@/mocks/db";
import type { TaskDetail, TaskStatus } from "@/types/db";

import { computeDDay, computeOverdue } from "./lib/d-day";

const changeStatusSchema = z.object({
  roomId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  /** 칸 안 위치. 기본 0 (맨 위) */
  toIndex: z.number().int().nonnegative().optional(),
  version: z.number().int().nonnegative(),
});

/**
 * 상태 변경 Server Action 응답 — **에러를 throw 하지 않고 kind 로 구분해서 리턴**한다.
 *
 * ⚠️ production React 는 Server Action 이 throw 한 메시지를 generic error text 로
 *    덮는다. "다른 사용자가 먼저 바꿨어요" 같은 안내가 그대로 UI 에 도달하려면 **데이터로**
 *    돌려주고 호출부가 kind 로 분기하는 형태가 안전 (CodeRabbit).
 *
 * - `ok` : 정상 적용, `task` 로 최신 상세
 * - `conflict` : version 불일치 (409). UI 는 "새로고침 후 다시 시도" 안내로 떨어뜨림
 * - `ok_detail_stale` : PATCH 는 성공했지만 직후 상세 refetch 가 실패. 변경은 서버에
 *   들어갔으므로 UI 는 재조회로 복구해야 하며 **재시도 하면 안 됨**
 * - `error` : 그 외 실패
 */
export type ChangeTaskStatusResult =
  | { kind: "ok"; task: TaskDetail }
  | { kind: "conflict"; message: string }
  | { kind: "ok_detail_stale"; message: string }
  | { kind: "error"; message: string };

const CONFLICT_MSG =
  "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.";
const DETAIL_STALE_MSG =
  "상태는 바뀌었지만 최신 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.";

export async function changeTaskStatusAction(
  input: unknown,
): Promise<ChangeTaskStatusResult> {
  let parsed: z.infer<typeof changeStatusSchema>;
  try {
    parsed = changeStatusSchema.parse(input);
  } catch {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, taskId, status, toIndex, version } = parsed;
  const insertAt = toIndex ?? 0;

  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    if (!t) {
      return { kind: "error", message: "업무를 찾을 수 없습니다." };
    }
    if (t.version !== version) {
      return { kind: "conflict", message: CONFLICT_MSG };
    }

    // ⚠️ 대상 컬럼의 기존 task 들 sortOrder 를 재배치한다. insertAt 위치 이상의
    //    task 는 모두 +1. 기존 로직은 무조건 0 으로 세팅해 기존 첫 task 와 타이가 났음
    //    (CodeRabbit).
    const columnTasks = tasks.filter(
      (x) =>
        x.roomId === roomId && x.status === status && x.taskId !== taskId,
    );
    for (const other of columnTasks) {
      if (other.sortOrder >= insertAt) {
        other.sortOrder += 1;
      }
    }

    const previousStatus: TaskStatus = t.status;
    t.status = status;
    t.completedAt = status === "DONE" ? new Date().toISOString() : null;
    t.dDay = computeDDay(t.dueDate);
    t.overdue = computeOverdue(t.dueDate, status);
    t.sortOrder = insertAt;
    t.version += 1;
    t.history = [
      ...t.history,
      {
        historyType: "STATUS_CHANGED",
        fromStatus: previousStatus,
        toStatus: status,
        fromAssignee: null,
        toAssignee: null,
        actor: t.registrant,
        createdAt: new Date().toISOString(),
      },
    ];
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    const { roomId: _r, sprintId: _s, ...detail } = t;
    void _r;
    void _s;
    return { kind: "ok", task: detail };
  }

  try {
    await api<unknown>(`/api/v1/rooms/${roomId}/tasks/${taskId}/status`, {
      method: "PATCH",
      json: { status, toIndex: insertAt, version },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { kind: "conflict", message: CONFLICT_MSG };
    }
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "상태 변경에 실패했습니다.",
    };
  }

  // ⚠️ PATCH 는 성공한 상태. 이 다음 GET 실패까지 error 로 묶으면 UI 가 재시도를
  //    권유해 409 로 이어진다. 분리된 kind 로 알린다 (CodeRabbit).
  revalidatePath(`/rooms/${roomId}/boards/task`, "page");
  try {
    const detail = await api<TaskDetail>(
      `/api/v1/rooms/${roomId}/tasks/${taskId}`,
    );
    return { kind: "ok", task: detail };
  } catch {
    return { kind: "ok_detail_stale", message: DETAIL_STALE_MSG };
  }
}
