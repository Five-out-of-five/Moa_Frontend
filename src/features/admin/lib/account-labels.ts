/**
 * 회원 관리에서 쓰는 enum → 한글 라벨 매핑. 요구사항 명세서 row 75(회원관리) / row 1(소셜 로그인)
 * 의 표기를 그대로 따른다.
 *
 * ⚠️ 라벨 변경은 **이 한 곳만** — 테이블·필터·Sheet·Dialog 가 전부 이 유틸을 참조한다.
 */

import type {
  AdminAccountRole,
  AdminAccountStatus,
  AdminSocialProvider,
  AdminSuspensionPeriod,
} from "../types";

const STATUS_LABELS: Record<AdminAccountStatus, string> = {
  ACTIVE: "정상",
  SUSPENDED: "정지",
  WITHDRAWN: "탈퇴",
};

const ROLE_LABELS: Record<AdminAccountRole, string> = {
  USER: "일반 회원",
  ADMIN: "서비스 관리자",
};

const PROVIDER_LABELS: Record<AdminSocialProvider, string> = {
  GOOGLE: "구글",
  KAKAO: "카카오",
  NAVER: "네이버",
};

const SUSPENSION_PERIOD_LABELS: Record<AdminSuspensionPeriod, string> = {
  DAYS_3: "3일",
  DAYS_7: "7일",
  DAYS_30: "30일",
  PERMANENT: "영구",
};

export function accountStatusLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return STATUS_LABELS[code as AdminAccountStatus] ?? code;
}

export function accountRoleLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return ROLE_LABELS[code as AdminAccountRole] ?? code;
}

export function accountProviderLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return PROVIDER_LABELS[code as AdminSocialProvider] ?? code;
}

export function suspensionPeriodLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return SUSPENSION_PERIOD_LABELS[code as AdminSuspensionPeriod] ?? code;
}

export const STATUS_OPTIONS: { value: AdminAccountStatus; label: string }[] = [
  { value: "ACTIVE", label: STATUS_LABELS.ACTIVE },
  { value: "SUSPENDED", label: STATUS_LABELS.SUSPENDED },
  { value: "WITHDRAWN", label: STATUS_LABELS.WITHDRAWN },
];

export const ROLE_OPTIONS: { value: AdminAccountRole; label: string }[] = [
  { value: "USER", label: ROLE_LABELS.USER },
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
];

export const PROVIDER_OPTIONS: { value: AdminSocialProvider; label: string }[] = [
  { value: "GOOGLE", label: PROVIDER_LABELS.GOOGLE },
  { value: "KAKAO", label: PROVIDER_LABELS.KAKAO },
  { value: "NAVER", label: PROVIDER_LABELS.NAVER },
];

export const SUSPENSION_PERIOD_OPTIONS: { value: AdminSuspensionPeriod; label: string }[] = [
  { value: "DAYS_3", label: SUSPENSION_PERIOD_LABELS.DAYS_3 },
  { value: "DAYS_7", label: SUSPENSION_PERIOD_LABELS.DAYS_7 },
  { value: "DAYS_30", label: SUSPENSION_PERIOD_LABELS.DAYS_30 },
  { value: "PERMANENT", label: SUSPENSION_PERIOD_LABELS.PERMANENT },
];
