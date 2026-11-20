/**
 * 신고 관리 enum → 한글 라벨. BE 명세 `AdminReportResponse` / `AdminReportDetailResponse` /
 * `ReportResolveRequest` / `ReportRejectRequest` 의 enum 값을 UI 에서 쓰기 편한 라벨로 바꾼다.
 *
 * ⚠️ 라벨 변경은 **이 한 곳만** — 테이블·필터·Sheet·Dialog·뱃지가 전부 이 유틸을 참조한다.
 */

import type {
  AdminReportAction,
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
} from "../types";

const STATUS_LABELS: Record<AdminReportStatus, string> = {
  RECEIVED: "접수됨",
  IN_PROGRESS: "처리 중",
  RESOLVED: "처리 완료",
  REJECTED: "반려",
};

const TARGET_TYPE_LABELS: Record<AdminReportTargetType, string> = {
  CARD: "아이디어 카드",
  COMMENT: "댓글",
  MESSAGE: "메시지",
};

const REASON_LABELS: Record<AdminReportReason, string> = {
  ABUSE: "욕설·비방",
  SPAM: "스팸",
  INAPPROPRIATE_FILE: "부적절한 파일",
  PRIVACY: "개인정보",
  ETC: "기타",
};

const ACTION_LABELS: Record<AdminReportAction, string> = {
  DELETE_CONTENT: "콘텐츠 삭제",
  SUSPEND_ACCOUNT: "계정 정지",
  WARN: "경고",
  NONE: "조치 없음",
};

export function reportStatusLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return STATUS_LABELS[code as AdminReportStatus] ?? code;
}

export function reportTargetTypeLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return TARGET_TYPE_LABELS[code as AdminReportTargetType] ?? code;
}

export function reportReasonLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return REASON_LABELS[code as AdminReportReason] ?? code;
}

export function reportActionLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return ACTION_LABELS[code as AdminReportAction] ?? code;
}

export const REPORT_STATUS_OPTIONS: { value: AdminReportStatus; label: string }[] = [
  { value: "RECEIVED", label: STATUS_LABELS.RECEIVED },
  { value: "IN_PROGRESS", label: STATUS_LABELS.IN_PROGRESS },
  { value: "RESOLVED", label: STATUS_LABELS.RESOLVED },
  { value: "REJECTED", label: STATUS_LABELS.REJECTED },
];

export const REPORT_TARGET_TYPE_OPTIONS: { value: AdminReportTargetType; label: string }[] = [
  { value: "CARD", label: TARGET_TYPE_LABELS.CARD },
  { value: "COMMENT", label: TARGET_TYPE_LABELS.COMMENT },
  { value: "MESSAGE", label: TARGET_TYPE_LABELS.MESSAGE },
];

export const REPORT_REASON_OPTIONS: { value: AdminReportReason; label: string }[] = [
  { value: "ABUSE", label: REASON_LABELS.ABUSE },
  { value: "SPAM", label: REASON_LABELS.SPAM },
  { value: "INAPPROPRIATE_FILE", label: REASON_LABELS.INAPPROPRIATE_FILE },
  { value: "PRIVACY", label: REASON_LABELS.PRIVACY },
  { value: "ETC", label: REASON_LABELS.ETC },
];

export const REPORT_ACTION_OPTIONS: { value: AdminReportAction; label: string }[] = [
  { value: "DELETE_CONTENT", label: ACTION_LABELS.DELETE_CONTENT },
  { value: "SUSPEND_ACCOUNT", label: ACTION_LABELS.SUSPEND_ACCOUNT },
  { value: "WARN", label: ACTION_LABELS.WARN },
  { value: "NONE", label: ACTION_LABELS.NONE },
];
