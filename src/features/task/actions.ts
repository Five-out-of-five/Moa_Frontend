"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isNextControlFlowError } from "@/lib/next-redirect";
import { isMock } from "@/mocks/config";
import { accounts, ideaCards, roomMembers, sprints, tasks } from "@/mocks/db";
import type { MemberRef, TaskDetail, TaskStatus } from "@/types/db";

import { computeDDay, computeOverdue } from "./lib/d-day";

/**
 * 목 저장 shape → 외부 Detail. `roomId` 는 경로 변수라서 응답에 안 들어가고,
 * `fileCount` 는 `files.length` 로 derived (실 BE 도 서버가 계산한 값을 내려줌).
 * server.ts `stripRoom` 과 동일 규칙.
 */
function toDetail(
  t: Omit<TaskDetail, "fileCount"> & { roomId: number },
): TaskDetail {
  const { roomId: _r, ...rest } = t;
  void _r;
  return { ...rest, fileCount: rest.files.length };
}

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
    sourceCardId: z.number().int().positive().optional(),
    title: z
      .string()
      .trim()
      .min(1, "업무 제목을 입력해 주세요.")
      .max(200, "업무 제목은 200자 이하로 입력해 주세요."),
    description: z.string().max(2000, "설명은 2000자 이하로 입력해 주세요."),
    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    assigneeAccountId: z.number().int().positive().nullable(),
    // ⚠️ regex 통과만 보면 "2026-02-31" 같은 **달력상 존재하지 않는 날짜** 가 통과돼
    //    저장된다 (CodeRabbit). regex + round-trip 으로 실제 Date 생성 후 입력한 년/월/일과
    //    일치하는지 검증한다 (Date 는 잘못된 날짜를 다음 달로 롤오버함).
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "마감일 형식이 올바르지 않습니다.")
      .refine(isValidCalendarDate, {
        message: "달력에 존재하지 않는 날짜예요.",
      })
      .nullable(),
  });

/**
 * "yyyy-MM-dd" 가 **달력상 실제로 존재하는 날짜** 인지 검사. 자바스크립트 `Date` 는
 * 잘못된 날짜 (예: 2026-02-31) 를 다음 달로 롤오버해서 생성하므로, 생성된 Date 의
 * 년/월/일을 원문자열과 다시 비교한다.
 */
function isValidCalendarDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

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

    const wasDone = previousStatus === "DONE";
    const isDone = status === "DONE";

    t.status = status;
    t.completedAt = isDone ? new Date().toISOString() : null;
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

    // ⚠️ DONE 진입/이탈 시 스프린트 집계 보정 — `updateTaskAction` 과 같은 규칙.
    //    이걸 빼면 상태 버튼으로 TODO↔DONE 왕복한 뒤 수정 Dialog 로 되돌릴 때 `doneTasks`
    //    가 실제 완료 수와 어긋난다 (CodeRabbit).
    if (t.sprintId !== null && wasDone !== isDone) {
      const sprint = sprints.find((s) => s.id === t.sprintId);
      if (sprint) {
        sprint.doneTasks = Math.max(0, sprint.doneTasks + (isDone ? 1 : -1));
      }
    }

    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    return { kind: "ok", task: toDetail(t) };
  }

  try {
    // ⚠️ BE 는 재정렬된 칸반 전체 Summary 리스트를 돌려준다. 이번 범위에선 Detail GET 재조회
    //    흐름을 유지하되, 응답 타입만 명시화해 돌려받는 shape 를 코드로 고정한다 (TODO:
    //    Phase 2 에서 List 응답으로 캐시 반영해 round-trip 제거 — [[업무 보드 그리드]]).
    await api<unknown[]>(`/api/v1/rooms/${roomId}/tasks/${taskId}/status`, {
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
    sourceCardId,
    title,
    description,
    status,
    priority,
    assigneeAccountId,
    dueDate,
  } = parsed.data;

  if (isMock) {
    const source = sourceCardId === undefined ? undefined : ideaCards.find(({ id, roomId: room }) => id === sourceCardId && room === roomId);
    if (sourceCardId !== undefined && (!source || source.convertedTaskId !== null)) {
      return { kind: "error", message: "업무로 전환할 카드를 확인해 주세요." };
    }
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
    const newTask: Omit<TaskDetail, "fileCount"> & { roomId: number } = {
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
      source: source ? { type: "CARD", id: source.id, title: source.title } : { type: "NONE", id: null, title: null },
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
    if (source) {
      source.convertedTaskId = newTaskId;
      revalidatePath(`/rooms/${roomId}/boards/idea`);
    }
    if (sprint) {
      sprint.totalTasks += 1;
      if (status === "DONE") sprint.doneTasks += 1;
    }
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    return { kind: "ok", task: toDetail(newTask) };
  }

  try {
    // ⚠️ BE `TaskCreateRequest` 는 `status` 를 받지 않는다 (서버가 TODO 로 고정 생성한 뒤
    //    활성 스프린트에 자동 배치). 다른 칸으로 바로 올리고 싶으면 생성 후 move 호출이 필요
    //    하지만, 이번 범위에서는 UI 가 TODO 가 아닌 상태를 고를 때의 흐름을 Phase 2 로 미룬다.
    const res = await api<TaskDetail>(`/api/v1/rooms/${roomId}/tasks`, {
      method: "POST",
      json: {
        title,
        description,
        priority,
        assigneeAccountId,
        dueDate,
        sourceCardId,
      },
    });
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    if (sourceCardId !== undefined) revalidatePath(`/rooms/${roomId}/boards/idea`);
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

/**
 * 업무 수정 입력 — 상세 Sheet 의 수정 Dialog 가 보내는 shape.
 *
 * ⚠️ 명세의 `PATCH /api/v1/rooms/{roomId}/tasks/{taskId}` 는 **수정 가능한 필드 전부를
 *    한 번에** 교체한다 (제목 · 설명 · 상태 · 우선순위 · 담당자 · 마감일). 담당자 변경
 *    전용 엔드포인트가 없어 담당자도 이 Dialog 로 바꾼다.
 * ⚠️ 스프린트는 명세 확정 전이라 수정 범위 외 — 생성 Dialog 와 동일.
 * ⚠️ `version` 으로 낙관적 잠금. 서버가 409 면 UI 는 재조회 안내로 떨어뜨림.
 */
const updateTaskSchema = z.object({
  roomId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  version: z.number().int().nonnegative(),
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
    .refine(isValidCalendarDate, {
      message: "달력에 존재하지 않는 날짜예요.",
    })
    .nullable(),
});

const idAndVersionSchema = z.object({
  roomId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  version: z.number().int().nonnegative(),
});

const idOnlyTaskSchema = z.object({
  roomId: z.number().int().positive(),
  taskId: z.number().int().positive(),
});

/**
 * 업무 수정 결과 — 생성/상태변경 액션과 같이 kind 리턴.
 * - `ok` : 수정 성공, `task` 최신 상세
 * - `conflict` : version 불일치 — 다른 사용자가 먼저 수정
 * - `error` : 그 외 실패 (검증, 권한 등)
 */
export type UpdateTaskResult =
  | { kind: "ok"; task: TaskDetail }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * 업무 수정 — 명세 `PATCH /api/v1/rooms/{roomId}/tasks/{taskId}`.
 *
 * 목 모드 구현:
 * - 작성자(registrant) 또는 담당자(assignee) 만 수정 가능 (방 멤버 체크 포함)
 * - 담당자가 바뀌면 `ASSIGNEE_CHANGED` 이력, 상태가 바뀌면 `STATUS_CHANGED` 이력을 각각 기록
 * - 상태가 바뀌면 새 컬럼의 **맨 아래** 로 sortOrder 밀어 넣는다 (changeTaskStatusAction 과 달리
 *   toIndex 없음 — 수정 흐름은 위치가 아니라 내용 교체가 주제)
 * - 스프린트 `doneTasks` 는 DONE 진입/이탈 시 보정
 */
export async function updateTaskAction(
  input: unknown,
): Promise<UpdateTaskResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      kind: "error",
      message:
        parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors,
    };
  }
  const {
    roomId,
    taskId,
    version,
    title,
    description,
    status,
    priority,
    assigneeAccountId,
    dueDate,
  } = parsed.data;

  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    if (!t) return { kind: "error", message: "업무를 찾을 수 없습니다." };
    if (t.version !== version) {
      return {
        kind: "conflict",
        message:
          "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.",
      };
    }
    const me = accounts[0];
    if (!me) return { kind: "error", message: "현재 계정을 확인하지 못했습니다." };
    const canEdit =
      t.registrant.accountId === me.id ||
      (t.assignee !== null && t.assignee.accountId === me.id);
    if (!canEdit) {
      return {
        kind: "error",
        message: "업무 작성자 또는 담당자만 수정할 수 있어요.",
      };
    }

    let newAssignee: MemberRef | null = null;
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
      const acc = accounts.find((a) => a.id === assigneeAccountId);
      newAssignee = {
        accountId: assigneeAccountId,
        displayName:
          assigneeMember.nickname ?? acc?.name ?? `사용자 ${assigneeAccountId}`,
        profileImageUrl: null,
        memberStatus: "ACTIVE",
      };
    }

    const now = new Date().toISOString();
    const previousStatus: TaskStatus = t.status;
    const previousAssignee = t.assignee;
    const statusChanged = previousStatus !== status;
    const assigneeChanged =
      (previousAssignee?.accountId ?? null) !== (newAssignee?.accountId ?? null);
    const wasDone = previousStatus === "DONE";
    const isDone = status === "DONE";

    const actor: MemberRef = {
      accountId: me.id,
      displayName: me.name,
      profileImageUrl: null,
      memberStatus: "ACTIVE",
    };

    t.title = title;
    t.description = description;
    t.priority = priority;
    t.dueDate = dueDate;
    t.dDay = computeDDay(dueDate);
    t.overdue = computeOverdue(dueDate, status);
    t.assignee = newAssignee;
    if (statusChanged) {
      t.status = status;
      t.completedAt = isDone ? now : null;
      // 새 컬럼의 맨 끝으로 밀어 넣는다 — 위치는 상태 변경 액션(toIndex)이 맡는 흐름이고,
      // 여기선 내용 교체가 주제라 자리 이동을 최소 침습으로 처리한다.
      const siblings = tasks
        .filter(
          (x) =>
            x.roomId === roomId &&
            x.status === status &&
            x.taskId !== taskId,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);
      siblings.push(t);
      siblings.forEach((task, i) => {
        task.sortOrder = i;
      });
    }
    if (statusChanged) {
      t.history = [
        ...t.history,
        {
          historyType: "STATUS_CHANGED",
          fromStatus: previousStatus,
          toStatus: status,
          fromAssignee: null,
          toAssignee: null,
          actor,
          createdAt: now,
        },
      ];
    }
    if (assigneeChanged) {
      t.history = [
        ...t.history,
        {
          historyType: "ASSIGNEE_CHANGED",
          fromStatus: null,
          toStatus: null,
          fromAssignee: previousAssignee,
          toAssignee: newAssignee,
          actor,
          createdAt: now,
        },
      ];
    }
    t.version += 1;

    // 스프린트 doneTasks 는 DONE 진입/이탈 시 보정
    if (t.sprintId !== null && wasDone !== isDone) {
      const sprint = sprints.find((s) => s.id === t.sprintId);
      if (sprint) {
        sprint.doneTasks = Math.max(
          0,
          sprint.doneTasks + (isDone ? 1 : -1),
        );
      }
    }

    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    return { kind: "ok", task: toDetail(t) };
  }

  // ⚠️ BE 는 수정을 **세 엔드포인트로 쪼개** 둔다. 하나로 묶인 UI Dialog 를 그대로 유지하려면
  //    액션이 현재 상태와 비교해 바뀐 축만 순차 호출한다. 호출 순서는 내용 → 담당자 → 상태:
  //    상태 변경이 마지막인 이유는 version 낙관적 잠금이 상태 PATCH 에만 적용되고, 내용·담당자
  //    변경이 서버의 version 을 올리기 전 시점에 최신 version 을 재바인딩하기 위함이다.
  //    한 PATCH 는 성공했는데 다음이 실패하면 "부분 반영" 상태가 남는데, revalidate 로 보드가
  //    재조회되므로 UI 는 최신 서버 상태에 재동기화된다.
  try {
    const previous = await api<TaskDetail>(
      `/api/v1/rooms/${roomId}/tasks/${taskId}`,
      { cache: "no-store" },
    );
    if (previous.version !== version) {
      return {
        kind: "conflict",
        message:
          "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.",
      };
    }

    const contentChanged =
      previous.title !== title ||
      (previous.description ?? "") !== description ||
      previous.priority !== priority ||
      (previous.dueDate ?? null) !== dueDate;
    const assigneeChanged =
      (previous.assignee?.accountId ?? null) !== assigneeAccountId;
    const statusChanged = previous.status !== status;

    let current = previous;

    if (contentChanged) {
      current = await api<TaskDetail>(
        `/api/v1/rooms/${roomId}/tasks/${taskId}`,
        {
          method: "PATCH",
          json: { title, description, dueDate, priority },
        },
      );
    }
    if (assigneeChanged) {
      current = await api<TaskDetail>(
        `/api/v1/rooms/${roomId}/tasks/${taskId}/assignee`,
        {
          method: "PATCH",
          json: { assigneeAccountId },
        },
      );
    }
    if (statusChanged) {
      // 상태 변경은 `/status` 로. 응답은 재정렬된 리스트지만 이번 범위에선 그대로 두고 상세를
      // 한 번 더 조회해 UI 가 최신 Detail 을 얻도록 한다. (TODO: Phase 2 — [[업무 보드 그리드]])
      try {
        await api<unknown[]>(
          `/api/v1/rooms/${roomId}/tasks/${taskId}/status`,
          {
            method: "PATCH",
            json: { status, toIndex: 0, version: current.version },
          },
        );
        current = await api<TaskDetail>(
          `/api/v1/rooms/${roomId}/tasks/${taskId}`,
          { cache: "no-store" },
        );
      } catch (e) {
        if (isNextControlFlowError(e)) throw e;
        if (e instanceof ApiError && e.status === 409) {
          return {
            kind: "conflict",
            message:
              "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.",
          };
        }
        throw e;
      }
    }

    return {
      kind: "ok",
      task: {
        ...current,
        dDay: computeDDay(current.dueDate),
        overdue: computeOverdue(current.dueDate, current.status),
      },
    };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "업무 수정에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  } finally {
    // ⚠️ 세 단계 중 **일부만 성공해도** 보드가 서버 최신 상태로 재동기화되도록 모든 리턴/throw
    //    경로에서 revalidate. conflict·error 분기 뒤에 Dialog 를 닫지 않아도 상위 보드는
    //    최신값으로 다시 그려진다.
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
  }
}

/**
 * 업무 삭제 결과 — 투표 삭제 패턴과 동일.
 * - `ok` : 삭제 완료
 * - `error` : 실패
 */
export type DeleteTaskResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

/**
 * 업무 삭제 — 명세 `DELETE /api/v1/rooms/{roomId}/tasks/{taskId}`. 작성자만.
 * 복구 불가이므로 UI 는 AlertDialog 로 confirm.
 */
export async function deleteTaskAction(
  input: unknown,
): Promise<DeleteTaskResult> {
  const parsed = idOnlyTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, taskId } = parsed.data;

  if (isMock) {
    const idx = tasks.findIndex(
      (x) => x.roomId === roomId && x.taskId === taskId,
    );
    if (idx < 0) return { kind: "error", message: "업무를 찾을 수 없습니다." };
    const target = tasks[idx]!;
    const me = accounts[0];
    if (!me || target.registrant.accountId !== me.id) {
      return { kind: "error", message: "업무 작성자만 삭제할 수 있어요." };
    }
    const wasDone = target.status === "DONE";
    const sprintId = target.sprintId;
    tasks.splice(idx, 1);
    const source = ideaCards.find((card) => card.roomId === roomId && card.convertedTaskId === taskId);
    if (source) source.convertedTaskId = null;
    if (sprintId !== null) {
      const sprint = sprints.find((s) => s.id === sprintId);
      if (sprint) {
        sprint.totalTasks = Math.max(0, sprint.totalTasks - 1);
        if (wasDone) sprint.doneTasks = Math.max(0, sprint.doneTasks - 1);
      }
    }
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    return { kind: "ok" };
  }

  try {
    await api(`/api/v1/rooms/${roomId}/tasks/${taskId}`, { method: "DELETE" });
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    return { kind: "ok" };
  } catch (e) {
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return {
      kind: "error",
      message: "업무 삭제에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

/**
 * 업무 반려 결과 — kind 리턴 패턴.
 * - `ok` : 반려 완료, `task` 최신 상세 (status 는 `TODO` 로 복귀, 담당자 해제)
 * - `conflict` : version 불일치
 * - `error` : 실패
 */
export type RejectTaskResult =
  | { kind: "ok"; task: TaskDetail }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

/**
 * 업무 반려 — 명세 `POST /api/v1/rooms/{roomId}/tasks/{taskId}/reject`.
 *
 * ⚠️ `TaskHistoryType.REJECTED` 는 명세에 있지만 `TaskStatus` 에는 반려 전용 값이 없다.
 *    반려는 **"담당자가 돌려 보냄"** 이므로 status 는 `TODO` 로 복귀시키고 담당자를
 *    해제 (null) 한다. 같은 업무에 다시 담당자를 배정하면 이어서 작업 가능.
 * ⚠️ 담당자만 반려 가능. 이미 `DONE` 인 업무는 반려 대상 아님.
 */
export async function rejectTaskAction(
  input: unknown,
): Promise<RejectTaskResult> {
  const parsed = idAndVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, taskId, version } = parsed.data;

  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    if (!t) return { kind: "error", message: "업무를 찾을 수 없습니다." };
    if (t.version !== version) {
      return {
        kind: "conflict",
        message:
          "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.",
      };
    }
    const me = accounts[0];
    if (!me) return { kind: "error", message: "현재 계정을 확인하지 못했습니다." };
    if (t.assignee === null || t.assignee.accountId !== me.id) {
      return { kind: "error", message: "담당자만 반려할 수 있어요." };
    }
    if (t.status === "DONE") {
      return { kind: "error", message: "이미 완료된 업무는 반려할 수 없어요." };
    }

    const now = new Date().toISOString();
    const previousStatus = t.status;
    const previousAssignee = t.assignee;
    const actor: MemberRef = {
      accountId: me.id,
      displayName: me.name,
      profileImageUrl: null,
      memberStatus: "ACTIVE",
    };

    t.status = "TODO";
    t.assignee = null;
    t.completedAt = null;
    t.dDay = computeDDay(t.dueDate);
    t.overdue = computeOverdue(t.dueDate, "TODO");
    // TODO 컬럼 맨 아래로 밀어 넣는다 — 담당자 재배정 흐름을 눈에 띄게.
    const siblings = tasks
      .filter(
        (x) =>
          x.roomId === roomId && x.status === "TODO" && x.taskId !== taskId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    siblings.push(t);
    siblings.forEach((task, i) => {
      task.sortOrder = i;
    });
    t.version += 1;
    t.history = [
      ...t.history,
      {
        historyType: "REJECTED",
        fromStatus: previousStatus,
        toStatus: "TODO",
        fromAssignee: previousAssignee,
        toAssignee: null,
        actor,
        createdAt: now,
      },
    ];
    revalidatePath(`/rooms/${roomId}/boards/task`, "page");
    return { kind: "ok", task: toDetail(t) };
  }

  try {
    // ⚠️ BE `POST /tasks/{id}/reject` 는 `@RequestBody` 자체가 없다. version 체크는 담당자
    //    검증 로직 안쪽에서 이뤄지므로 FE 는 body 없이 호출만 보낸다.
    void version;
    const res = await api<TaskDetail>(
      `/api/v1/rooms/${roomId}/tasks/${taskId}/reject`,
      { method: "POST" },
    );
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
    if (e instanceof ApiError && e.status === 409) {
      return {
        kind: "conflict",
        message:
          "다른 사용자가 먼저 업데이트했어요. 새로고침 후 다시 시도해 주세요.",
      };
    }
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return {
      kind: "error",
      message: "업무 반려에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}
