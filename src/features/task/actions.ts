"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { tasks } from "@/mocks/db";
import type { TaskDetail, TaskStatus } from "@/types/db";

const changeStatusSchema = z.object({
  roomId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  /** 칸 안 위치 — 명세. 이번 범위는 간단히 끝(맨 위) 으로 떨어뜨린다 (toIndex=0). */
  toIndex: z.number().int().nonnegative().optional(),
  version: z.number().int().nonnegative(),
});

/**
 * 업무 상태 변경 (칸반 이동) — 명세 `PATCH /api/v1/rooms/{roomId}/tasks/{taskId}/status`.
 *
 * ⚠️ 명세 응답은 **"바뀐 칸들의 업무 목록"** (`TaskSummaryResponse[]`) 이다. 이 PR 에선
 *    상세에서만 상태를 바꾸므로 여기서는 돌려받은 상세로 로컬 state 를 덮는 것만 호출부가
 *    쓰고 (useOptimistic 과 혼합 가능), 목 쪽은 해당 Task 를 직접 수정한다.
 * ⚠️ `version` 이 불일치하면 서버가 409 를 던진다 — 호출부는 UI 에 "다른 사용자가 먼저
 *    업데이트했어요" 안내로 떨어뜨리는 게 명세 가이드.
 */
export async function changeTaskStatusAction(
  input: unknown,
): Promise<TaskDetail> {
  const { roomId, taskId, status, toIndex, version } =
    changeStatusSchema.parse(input);

  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    if (!t) throw new Error("업무를 찾을 수 없습니다.");
    if (t.version !== version) {
      throw new Error("다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.");
    }
    const previousStatus: TaskStatus = t.status;
    t.status = status;
    t.completedAt = status === "DONE" ? new Date().toISOString() : null;
    t.overdue = t.dDay !== null && t.dDay < 0 && status !== "DONE";
    t.sortOrder = toIndex ?? 0;
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
    return detail;
  }

  await api<unknown>(
    `/api/v1/rooms/${roomId}/tasks/${taskId}/status`,
    {
      method: "PATCH",
      json: { status, toIndex: toIndex ?? 0, version },
    },
  );
  // 명세상 status 변경 응답은 Summary[] 지만, UI 는 직후 상세를 다시 받아 history 를 보여준다.
  const detail = await api<TaskDetail>(
    `/api/v1/rooms/${roomId}/tasks/${taskId}`,
  );
  revalidatePath(`/rooms/${roomId}/boards/task`, "page");
  return detail;
}
