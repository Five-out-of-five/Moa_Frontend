import "server-only";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers, sprints, tasks } from "@/mocks/db";
import type {
  MemberLoad,
  RoomProgress,
  RoomWorkload,
  Sprint,
  TaskDetail,
  TaskPriority,
  TaskStatus,
  TaskSummary,
  WorkloadLevel,
  WorkloadWarning,
} from "@/types/db";

import { computeDDay, computeOverdue } from "./lib/d-day";

/** BE `DUE_SOON_DAYS` 와 맞춤 — 오늘 포함 3일 이내 마감이면 due soon. */
const DUE_SOON_DAYS = 3;

/**
 * 목 저장 shape → 외부 Detail. `roomId` 는 경로 변수라서 응답에는 들어가지 않고,
 * `fileCount` 는 `files.length` 로 derived (실 BE 도 서버가 계산한 값을 내려줌).
 */
function stripRoom(
  t: Omit<TaskDetail, "fileCount"> & { roomId: number },
): TaskDetail {
  const { roomId: _room, ...detail } = t;
  void _room;
  return { ...detail, fileCount: t.files.length };
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
    sprintId: t.sprintId,
    fileCount: t.fileCount,
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
      .map((t) => withFreshDDay(toSummary(stripRoom(t))));
  }
  const list = await api<TaskSummary[]>(`/api/v1/rooms/${roomId}/tasks`);
  return list.map(withFreshDDay);
}

/**
 * 방의 **활성 스프린트** — 업무 생성 Dialog 의 스프린트 셀렉터와 진행률 바에 쓴다.
 *
 * ⚠️ 명세상 방당 활성 스프린트는 0~1개 (UI 가 한 번에 하나만 다룸). 없을 수도 있어
 *    `null` 을 돌려주고, Dialog 는 "활성 스프린트 없음" 상태로 노출한다.
 * ⚠️ 목 모드에선 **공유 `tasks` 저장소에서 매번 live 집계**해 `totalTasks`·`doneTasks`
 *    에 실어 돌려준다 — `sprints` 는 `shareSettingsMock` 바깥(모듈 로컬) 이라 HMR 이나
 *    서로 다른 모듈 인스턴스에서 집계가 drift 할 수 있다 (CodeRabbit). tasks 는 globalThis
 *    로 공유되므로 live 계산은 안전하고, 상태 변경·반려·삭제·수정 등 각 액션에서 집계
 *    보정을 잊어도 reader 레벨에서 자동으로 맞춰진다.
 * ⚠️ 실 API 는 `GET /api/v1/rooms/{roomId}/sprints/current`. BE 는 활성 스프린트가 없으면
 *    성공 봉투에 `data: null` 로 돌려준다 (`findFirst...orElse(null)`) — 404 가 아니다.
 *    `api<T | null>` 로 nullable 응답을 명시해 받고, 혹시라도 404 가 떨어지면 안전망으로
 *    같이 null 로 수렴한다. BE `SprintResponse` 는 FE `Sprint` 와 shape 가 다르므로 어댑터로 매핑.
 */
export async function getActiveSprint(
  roomId: number,
): Promise<Sprint | null> {
  if (isMock) {
    const sprint = sprints.find(
      (s) => s.roomId === roomId && s.state === "ACTIVE",
    );
    if (!sprint) return null;
    const sprintTasks = tasks.filter(
      (t) => t.roomId === roomId && t.sprintId === sprint.id,
    );
    return {
      ...sprint,
      totalTasks: sprintTasks.length,
      doneTasks: sprintTasks.filter((t) => t.status === "DONE").length,
    };
  }
  try {
    const res = await api<SprintResponse | null>(
      `/api/v1/rooms/${roomId}/sprints/current`,
      { cache: "no-store" },
    );
    return res ? toSprint(roomId, res) : null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * BE `SprintResponse` — `/sprints/current` 응답. 최소한의 필드만 적어 어댑터로 바로 소화한다.
 */
type SprintResponse = {
  sprintId: number;
  name: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "CLOSED";
  totalTaskCount: number;
  doneTaskCount: number;
};

function toSprint(roomId: number, res: SprintResponse): Sprint {
  return {
    id: res.sprintId,
    roomId,
    name: res.name,
    state: res.status,
    startsAt: res.startDate,
    endsAt: res.endDate,
    totalTasks: res.totalTaskCount,
    doneTasks: res.doneTaskCount,
  };
}

/** 업무 상세 조회 — 명세 `GET /api/v1/rooms/{roomId}/tasks/{taskId}`. */
export async function getTaskDetail(
  roomId: number,
  taskId: number,
): Promise<TaskDetail | null> {
  if (isMock) {
    const t = tasks.find((x) => x.roomId === roomId && x.taskId === taskId);
    return t ? withFreshDDay(stripRoom(t)) : null;
  }
  const detail = await api<TaskDetail>(
    `/api/v1/rooms/${roomId}/tasks/${taskId}`,
  );
  return withFreshDDay(detail);
}

/**
 * 진척도 — 명세 `GET /api/v1/rooms/{roomId}/tasks/progress` `ProgressResponse`.
 *
 * 활성 스프린트에 속한 업무만 집계한다. 활성 스프린트가 없으면 `sprint: null` 에 전부
 * 0 (totalCount·doneCount·progressRate·statusCounts·dueSoonCount 모두 0) — BE 와 같은 규칙.
 *
 * ⚠️ 목 모드는 BE 와 동일한 집계 규칙을 FE 에서 재현. BE 가 EnumMap 으로 모든 TaskStatus
 *    키를 돌려주므로 FE 도 4개 상태 전부 초기화한다 (UI 가 없는 상태 라벨 조회를 피함).
 */
export async function getRoomProgress(roomId: number): Promise<RoomProgress> {
  if (isMock) {
    const sprint = sprints.find(
      (s) => s.roomId === roomId && s.state === "ACTIVE",
    );
    const sprintTasks = sprint
      ? tasks.filter(
          (t) => t.roomId === roomId && t.sprintId === sprint.id,
        )
      : [];
    const statusCounts: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
    };
    for (const t of sprintTasks) statusCounts[t.status] += 1;
    const doneCount = statusCounts.DONE;
    const totalCount = sprintTasks.length;
    const progressRate =
      totalCount === 0 ? 0 : Math.floor((doneCount * 100) / totalCount);
    const limit = addDaysKst(DUE_SOON_DAYS);
    const dueSoonCount = sprintTasks.filter(
      (t) =>
        t.status !== "DONE" &&
        t.dueDate !== null &&
        t.dueDate <= limit,
    ).length;
    return {
      sprint: sprint
        ? {
            sprintId: sprint.id,
            // BE 는 sprintNo 를 별도 저장하지만 목 Sprint 엔 없어 id 를 재사용한다.
            sprintNo: sprint.id,
            name: sprint.name,
            startDate: sprint.startsAt.slice(0, 10),
            endDate: sprint.endsAt ? sprint.endsAt.slice(0, 10) : null,
          }
        : null,
      totalCount,
      doneCount,
      progressRate,
      statusCounts,
      dueSoonCount,
    };
  }
  return api<RoomProgress>(
    `/api/v1/rooms/${roomId}/tasks/progress`,
    { cache: "no-store" },
  );
}

/**
 * 업무 밸런서 — 명세 `GET /api/v1/rooms/{roomId}/tasks/workload` `WorkloadResponse`.
 *
 * 방의 **담당자 지정된 open 업무** (DONE 제외) 를 멤버별로 집계. 미담당 수는 응답에 없고
 * TaskBalancer 가 Summary 에서 별도로 계산한다. BE 공식과 1:1 매칭:
 *   score = Σ(priority weight + (dueDate 가 오늘~+3일 이내면 1, 아니면 0))
 *   priority weight: HIGH 1.5, NORMAL 1, LOW 0.5
 *   level: score < 3 → RELAXED, < 6 → NORMAL, 그 이상 → OVERLOADED
 *   warnings: OVERLOADED 이거나 (평균>0 & score>=평균*2) 면 추가
 */
export async function getRoomWorkload(roomId: number): Promise<RoomWorkload> {
  if (isMock) {
    const memberIds = roomMembers
      .filter((m) => m.roomId === roomId && m.state === "ACTIVE")
      .map((m) => m.accountId);
    const limit = addDaysKst(DUE_SOON_DAYS);
    const openByAssignee = new Map<number, typeof tasks>();
    for (const t of tasks) {
      if (t.roomId !== roomId) continue;
      if (t.status === "DONE") continue;
      if (!t.assignee) continue;
      const bucket = openByAssignee.get(t.assignee.accountId) ?? [];
      bucket.push(t);
      openByAssignee.set(t.assignee.accountId, bucket);
    }
    const members: MemberLoad[] = memberIds.map((id) => {
      const mine = openByAssignee.get(id) ?? [];
      const score = mine.reduce(
        (s, t) =>
          s +
          priorityWeight(t.priority) +
          (t.dueDate !== null && t.dueDate <= limit ? 1 : 0),
        0,
      );
      return {
        accountId: id,
        displayName: displayNameOf(id, roomId),
        score,
        level: classifyLevel(score),
        openTaskCount: mine.length,
      };
    }).sort((a, b) => a.score - b.score);
    const averageScore =
      members.length === 0
        ? 0
        : members.reduce((s, m) => s + m.score, 0) / members.length;
    const warnings: WorkloadWarning[] = [];
    for (const m of members) {
      if (m.level === "OVERLOADED") {
        warnings.push({ accountId: m.accountId, reason: "OVERLOADED" });
      } else if (averageScore > 0 && m.score >= averageScore * 2) {
        warnings.push({ accountId: m.accountId, reason: "DOUBLE_OF_AVERAGE" });
      }
    }
    return { members, averageScore, warnings };
  }
  return api<RoomWorkload>(
    `/api/v1/rooms/${roomId}/tasks/workload`,
    { cache: "no-store" },
  );
}

function priorityWeight(p: TaskPriority): number {
  return p === "HIGH" ? 1.5 : p === "LOW" ? 0.5 : 1;
}

function classifyLevel(score: number): WorkloadLevel {
  if (score < 3) return "RELAXED";
  if (score < 6) return "NORMAL";
  return "OVERLOADED";
}

/** 오늘(KST) 기준 N일 뒤의 "yyyy-MM-dd". task.dueDate 비교에 사용. */
function addDaysKst(days: number): string {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  nowKst.setUTCDate(nowKst.getUTCDate() + days);
  return nowKst.toISOString().slice(0, 10);
}

function displayNameOf(accountId: number, roomId: number): string {
  const rm = roomMembers.find(
    (m) => m.roomId === roomId && m.accountId === accountId,
  );
  if (rm?.nickname) return rm.nickname;
  const acc = accounts.find((a) => a.id === accountId);
  return acc?.name ?? `사용자 ${accountId}`;
}
