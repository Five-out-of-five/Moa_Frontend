import type {
  TaskHistoryType,
  TaskPriority,
  TaskSourceType,
  TaskStatus,
} from "@/types/db";

/**
 * 명세 enum → UI 한국어 라벨 매핑. 명세는 대문자 스네이크이고 UI 는 한국어 문구라,
 * 전환 테이블을 여기 한 곳에 모아 둔다.
 */

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  REVIEW: "리뷰",
  DONE: "완료",
};

export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "낮음",
  NORMAL: "보통",
  HIGH: "높음",
};

export const TASK_SOURCE_LABEL: Record<TaskSourceType, string> = {
  NONE: "직접 등록",
  CARD: "아이디어 카드",
  VOTE: "투표",
};

export const TASK_HISTORY_LABEL: Record<TaskHistoryType, string> = {
  CREATED: "업무 생성",
  STATUS_CHANGED: "상태 변경",
  ASSIGNEE_CHANGED: "담당자 변경",
  REJECTED: "반려",
};

/** 우선순위에 따른 뱃지 색 — 디자인 토큰으로만 지정. */
export const TASK_PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-secondary text-brand",
  HIGH: "bg-danger/10 text-danger",
};

/** 칸반 각 컬럼 헤더 색상 — 상태별로 소프트하게 구분 */
export const TASK_STATUS_HEADER_CLASS: Record<TaskStatus, string> = {
  TODO: "text-muted-foreground",
  IN_PROGRESS: "text-brand",
  REVIEW: "text-warning",
  DONE: "text-success",
};

/** dDay 숫자를 한국어 문구로 */
export function formatDDay(dDay: number | null, overdue: boolean): string {
  if (dDay === null) return "기한 없음";
  if (dDay === 0) return "오늘 마감";
  if (dDay < 0) return overdue ? `${Math.abs(dDay)}일 지남` : `${Math.abs(dDay)}일 전 마감`;
  return `D-${dDay}`;
}
