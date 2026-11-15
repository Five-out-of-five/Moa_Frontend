"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers, sprints, tasks } from "@/mocks/db";
import type { MemberRef, TaskDetail, TaskStatus } from "@/types/db";

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
 * 새 업무 생성 입력 — Figma Make "새 업무 추가" 다이얼로그가 보내는 shape.
 *
 * ⚠️ `description` 은 빈 문자열 허용 (설명 없이 제목만 등록 가능).
 * ⚠️ `assigneeAccountId` 는 **null = 미담당**. 명세 `TaskDetail.assignee: MemberRef | null`
 *    과 맞춤.
 * ⚠️ `dueDate` 는 BE 명세 "yyyy-MM-dd" (KST 달력 기준). 빈 값이면 null.
 * ⚠️ 스프린트 ID 는 **현재 활성 스프린트 1개로 서버가 자동** 소속시킨다 — 명세 확정 전까지
 *    FE 는 스프린트 선택 UI 를 노출하지 않는다 (이슈 #40 범위 외).
 */
const createTaskSchema = z
  .object({
    roomId: z.number().int().positive(),
    title: z
      .string()
      .trim()
      .min(1, "업무 제목을 입력해 주세요.")
      .max(200, "업무 제목은 200자 이하로 입력해 주세요."),
    description: z.string().max(2000, "설명은 2000자 이하로 입력해 주세요."),
    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    assigneeAccountId: z.number().int().positive().nullable(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "마감일 형식이 올바르지 않습니다.")
      .nullable(),
  });

/**
 * 업무 생성 결과 — 참여/투표 액션과 같이 **throw 하지 않고 kind 로 구분해서 리턴**.
 * - `ok` : 생성 성공, `task` 신규 상세 (상세 Sheet 자동 오픈용)
 * - `error` : 검증 실패 or 서버 거절 — `fieldErrors` 는 zod 가 잡은 필드 단위 메시지
 */
export type CreateTaskResult =
  | { kind: "ok"; task: TaskDetail }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

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

    // ⚠️ 대상 컬럼을 **sortOrder 오름차순으로 정렬한 뒤 array 위치 기준으로 reindex** 한다.
    //    기존 sortOrder 가 0, 4, 8 처럼 sparse 하면 단순히 ">= insertAt" 으로 +1 하는 로직은
    //    요청 "toIndex=2" 를 올바른 위치에 꽂지 못한다 (CodeRabbit). 순서를 정하고 0..N 로
    //    재번호하면 array index 와 sortOrder 가 일치해 정렬이 안정됨.
    const previousStatus: TaskStatus = t.status;
    const siblings = tasks
      .filter(
        (x) =>
          x.roomId === roomId && x.status === status && x.taskId !== taskId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const clampedIndex = Math.min(insertAt, siblings.length);
    const reordered = [
      ...siblings.slice(0, clampedIndex),
      t,
      ...siblings.slice(clampedIndex),
    ];
    reordered.forEach((task, i) => {
      task.sortOrder = i;
    });

    t.status = status;
    t.completedAt = status === "DONE" ? new Date().toISOString() : null;
    t.dDay = computeDDay(t.dueDate);
    t.overdue = computeOverdue(t.dueDate, status);
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
    // API 응답의 dDay·overdue 는 서버 타임존 영향을 받을 수 있어 server.ts 와 같은 규칙으로
    // 재계산해 UI 전역의 D-day 와 일관성을 맞춘다 (CodeRabbit).
    return {
      kind: "ok",
      task: {
        ...detail,
        dDay: computeDDay(detail.dueDate),
        overdue: computeOverdue(detail.dueDate, detail.status),
      },
    };
  } catch {
    return { kind: "ok_detail_stale", message: DETAIL_STALE_MSG };
  }
}

/**
 * 새 업무 생성 — 명세 `POST /api/v1/rooms/{roomId}/tasks` → `TaskDetailResponse`.
 *
 * 목 모드:
 * - 생성자는 홍근 (accounts[0]) 로 가정 (BE 가 붙으면 세션으로 교체)
 * - 담당자는 유효한 활성 방 멤버인지 검증, null 이면 미담당으로 등록
 * - 현재 방의 활성 스프린트 1개에 자동 소속 + 스프린트 `totalTasks` +1
 * - `sortOrder` 는 해당 status 의 최대값 +1 (기존 순서 보존, 맨 아래 추가)
 * - `history` 에 CREATED 이벤트 기록
 * - `revalidatePath('/rooms/{roomId}/boards/task')` 로 목록 즉시 재조회
 */
export async function createTaskAction(
  input: unknown,
): Promise<CreateTaskResult> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors,
    };
  }
  const {
    roomId,
    title,
    description,
    status,
    priority,
    assigneeAccountId,
    dueDate,
  } = parsed.data;

  if (isMock) {
    const me = accounts[0];
    if (!me) {
      return { kind: "error", message: "현재 계정을 확인하지 못했습니다." };
    }
    const meBelongs = roomMembers.some(
      (m) => m.roomId === roomId && m.accountId === me.id && m.state === "ACTIVE",
    );
    if (!meBelongs) {
      return { kind: "error", message: "이 방의 멤버만 업무를 만들 수 있어요." };
    }
    let assignee: MemberRef | null = null;
    if (assigneeAccountId !== null) {
      const assigneeMember = roomMembers.find(
        (m) =>
          m.roomId === roomId &&
          m.accountId === assigneeAccountId &&
          m.state === "ACTIVE",
      );
      if (!assigneeMember) {
        return {
          kind: "error",
          message: "선택한 담당자가 이 방의 활성 멤버가 아닙니다.",
          fieldErrors: { assigneeAccountId: "담당자를 다시 선택해 주세요." },
        };
      }
      const assigneeAcc = accounts.find((a) => a.id === assigneeAccountId);
      assignee = {
        accountId: assigneeAccountId,
        displayName:
          assigneeMember.nickname ?? assigneeAcc?.name ?? `사용자 ${assigneeAccountId}`,
        profileImageUrl: null,
        memberStatus: "ACTIVE",
      };
    }
    const registrant: MemberRef = {
      accountId: me.id,
      displayName: me.name,
      profileImageUrl: null,
      memberStatus: "ACTIVE",
    };
    const sprint = sprints.find(
      (s) => s.roomId === roomId && s.state === "ACTIVE",
    );
    const newTaskId = nextMockId(tasks.map((t) => t.taskId));
    const now = new Date().toISOString();
    // 같은 status 열의 맨 아래로 — 기존 sortOrder 최대값 +1.
    const sortOrder =
      tasks
        .filter((t) => t.roomId === roomId && t.status === status)
        .reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;
    const newTask: TaskDetail & { roomId: number; sprintId: number | null } = {
      taskId: newTaskId,
      roomId,
      sprintId: sprint?.id ?? null,
      title,
      description,
      status,
      priority,
      dueDate,
      dDay: computeDDay(dueDate),
      overdue: computeOverdue(dueDate, status),
      sortOrder,
      version: 1,
      registrant,
      assignee,
      source: { type: "NONE", id: null, title: null },
      completedAt: status === "DONE" ? now : null,
      files: [],
      history: [
        {
          historyType: "CREATED",
          fromStatus: null,
          toStatus: status,
          fromAssignee: null,
          toAssignee: assignee,
          actor: registrant,
          createdAt: now,
        },
      ],
      createdAt: now,
    };
    tasks.push(newTask);
    if (sprint) {
      sprint.totalTasks += 1;
      if (status === "DONE") sprint.doneTasks += 1;
    }
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    const { roomId: _r, sprintId: _s, ...detail } = newTask;
    void _r;
    void _s;
    return { kind: "ok", task: detail };
  }

  try {
    const res = await api<TaskDetail>(`/api/v1/rooms/${roomId}/tasks`, {
      method: "POST",
      json: {
        title,
        description,
        status,
        priority,
        assigneeAccountId,
        dueDate,
      },
    });
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    return {
      kind: "ok",
      task: {
        ...res,
        dDay: computeDDay(res.dueDate),
        overdue: computeOverdue(res.dueDate, res.status),
      },
    };
  } catch (e) {
    if (e instanceof ApiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "업무 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

/**
 * 목 저장소의 다음 사용 가능한 id. 투표 액션(`features/vote/actions.ts`) 과 같은 이유로
 * `seq` 발급기를 import 하지 않고 기존 최대값 +1 을 쓴다.
 */
function nextMockId(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
