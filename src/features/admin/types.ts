/**
 * 관리자 영역 응답 타입 — OpenAPI(`src/types/api.d.ts`) 에서 끌어와 도메인 안에서 쓰기 좋은
 * 이름으로 다시 내보낸다.
 *
 * ⚠️ BE 명세가 바뀌면 `npm run generate:api` 로 `api.d.ts` 를 다시 생성한다. 여기선 그걸
 *    한 번 더 베끼지 않고 재export 만 한다 — 명세 단일 출처(OpenAPI) 를 지키기 위함.
 */

import type { components } from "@/types/api";

export type StatsOverview = components["schemas"]["StatsOverviewResponse"];
export type AiUsageStats = components["schemas"]["AiUsageStatsResponse"];
export type AiUsageByFeature = components["schemas"]["ByFeature"];
export type StatsSeriesPoint = components["schemas"]["Point"];
export type AdminAuditLog = components["schemas"]["AuditLogResponse"];
export type AdminAuditLogPage = components["schemas"]["PageResponseAuditLogResponse"];

/** 기간 집계 단위 — BE 쿼리 파라미터 `unit` 값. */
export type StatsUnit = "DAY" | "WEEK" | "MONTH";

export interface StatsRangeQuery {
  unit: StatsUnit;
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
}

// ===== 회원 관리 =====

export type AdminAccount = components["schemas"]["AdminAccountResponse"];
export type AdminAccountDetail = components["schemas"]["AdminAccountDetailResponse"];
export type AdminSuspension = components["schemas"]["Suspension"];

export type AdminAccountRole = "USER" | "ADMIN";
export type AdminAccountStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";
export type AdminSocialProvider = "GOOGLE" | "KAKAO" | "NAVER";
export type AdminSuspensionPeriod = "DAYS_3" | "DAYS_7" | "DAYS_30" | "PERMANENT";

export interface AdminAccountListQuery {
  keyword?: string;
  provider?: AdminSocialProvider;
  status?: AdminAccountStatus;
  role?: AdminAccountRole;
  joinedFrom?: string;
  joinedTo?: string;
  page?: number;
  size?: number;
}

export interface AdminAccountPage {
  content: AdminAccount[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

// ===== 신고 관리 =====

export type AdminReport = components["schemas"]["AdminReportResponse"];
export type AdminReportDetail = components["schemas"]["AdminReportDetailResponse"];

export type AdminReportStatus = "RECEIVED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
export type AdminReportTargetType = "CARD" | "COMMENT" | "MESSAGE";
export type AdminReportReason =
  | "ABUSE"
  | "SPAM"
  | "INAPPROPRIATE_FILE"
  | "PRIVACY"
  | "ETC";
export type AdminReportAction =
  | "DELETE_CONTENT"
  | "SUSPEND_ACCOUNT"
  | "WARN"
  | "NONE";

export interface AdminReportListQuery {
  status?: AdminReportStatus;
  targetType?: AdminReportTargetType;
  reason?: AdminReportReason;
  page?: number;
  size?: number;
}

export interface AdminReportPage {
  content: AdminReport[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

// ===== 감사 로그 =====

export interface AdminAuditLogListQuery {
  adminId?: number;
  actionType?: string;
  targetType?: string;
  /** yyyy-MM-dd */
  from?: string;
  /** yyyy-MM-dd */
  to?: string;
  page?: number;
  size?: number;
}

// ===== 공지 관리 =====

export type AdminNotice = components["schemas"]["AdminNoticeResponse"];
export type AdminNoticeDetail = components["schemas"]["NoticeResponse"];
export type AdminNoticeType = "GENERAL" | "MAINTENANCE" | "URGENT";

/** BE 가 string 으로 돌려주지만 운영 중 쓰이는 값만 열거해 UI 셀렉트에 노출.
 *  BE `AdminNoticeService::stateOf` 가 돌려주는 리터럴과 정확히 맞춘다. */
export type AdminNoticeState = "SCHEDULED" | "ACTIVE" | "ENDED";

export interface AdminNoticeListQuery {
  noticeType?: AdminNoticeType;
  state?: string;
  page?: number;
  size?: number;
}

export interface AdminNoticePage {
  content: AdminNotice[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

/** `NoticeRequest` payload (POST/PUT 공용). `maintenanceStartsAt` 은 MAINTENANCE 에만 사용. */
export interface AdminNoticeRequest {
  noticeType: AdminNoticeType;
  title: string;
  content: string;
  /** ISO date-time */
  displayStartsAt: string;
  /** ISO date-time */
  displayEndsAt: string;
  /** ISO date-time, MAINTENANCE 선택 입력 */
  maintenanceStartsAt?: string;
}

// ===== 방 관리 =====

export type AdminRoom = components["schemas"]["AdminRoomResponse"];
export type AdminRoomDetail = components["schemas"]["AdminRoomDetailResponse"];
export type AdminRoomStatus = "ACTIVE" | "INACTIVE";

export interface AdminRoomListQuery {
  keyword?: string;
  status?: AdminRoomStatus;
  /** N일 이상 활동이 없는 방만 */
  inactiveDays?: number;
  /** BE 가 받는 정렬 토큰 (createdAt/lastActivityAt/memberCount/reportCount 등). */
  sort?: string;
  page?: number;
  size?: number;
}

export interface AdminRoomPage {
  content: AdminRoom[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
