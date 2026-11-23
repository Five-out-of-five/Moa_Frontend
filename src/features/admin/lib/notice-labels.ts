/**
 * 공지 관리 enum → 한글 라벨. `noticeType` 은 명세 enum(3종), `state` 는 BE 가 string 으로
 * 돌려주지만 운영 중 쓰이는 값만 열거.
 *
 * ⚠️ 라벨 변경은 **이 한 곳만** — 테이블/필터/Sheet/Dialog 참조.
 */

import type { AdminNoticeType } from "../types";

const TYPE_LABELS: Record<AdminNoticeType, string> = {
  GENERAL: "일반",
  MAINTENANCE: "점검",
  URGENT: "긴급",
};

/** BE 가 string 이라 모르는 값은 원문 그대로 노출. 키는 BE `AdminNoticeService::stateOf` 와 일치. */
const STATE_LABELS: Record<string, string> = {
  SCHEDULED: "예약",
  ACTIVE: "노출 중",
  ENDED: "종료",
};

export function noticeTypeLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return Object.hasOwn(TYPE_LABELS, code)
    ? TYPE_LABELS[code as AdminNoticeType]
    : code;
}

export function noticeStateLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return Object.hasOwn(STATE_LABELS, code) ? STATE_LABELS[code] : code;
}

export const NOTICE_TYPE_OPTIONS: { value: AdminNoticeType; label: string }[] = [
  { value: "GENERAL", label: TYPE_LABELS.GENERAL },
  { value: "MAINTENANCE", label: TYPE_LABELS.MAINTENANCE },
  { value: "URGENT", label: TYPE_LABELS.URGENT },
];

export const NOTICE_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "SCHEDULED", label: STATE_LABELS.SCHEDULED },
  { value: "ACTIVE", label: STATE_LABELS.ACTIVE },
  { value: "ENDED", label: STATE_LABELS.ENDED },
];
