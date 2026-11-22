/**
 * 방 관리 enum → 한글 라벨. 운영 중 쓰일 정렬 토큰도 UI 드롭다운용으로 열거.
 */

import type { AdminRoomStatus } from "../types";

const STATUS_LABELS: Record<AdminRoomStatus, string> = {
  ACTIVE: "정상",
  INACTIVE: "비활성",
};

export function roomStatusLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return Object.hasOwn(STATUS_LABELS, code)
    ? STATUS_LABELS[code as AdminRoomStatus]
    : code;
}

export const ROOM_STATUS_OPTIONS: { value: AdminRoomStatus; label: string }[] = [
  { value: "ACTIVE", label: STATUS_LABELS.ACTIVE },
  { value: "INACTIVE", label: STATUS_LABELS.INACTIVE },
];

/** 정렬 토큰 — BE `AdminRoomController` 가 받는 enum 문자열. 기본 `CREATED`. */
export const ROOM_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "LAST_ACTIVITY", label: "최근 활동 순" },
  { value: "CREATED", label: "최신 생성 순" },
  { value: "REPORT_COUNT", label: "신고 많은 순" },
];

/** 비활성 일수 — "N일 이상 활동이 없는 방" 셀렉트. */
export const ROOM_INACTIVE_DAYS_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7일 이상" },
  { value: 14, label: "14일 이상" },
  { value: 30, label: "30일 이상" },
  { value: 90, label: "90일 이상" },
];
