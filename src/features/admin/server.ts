import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { api } from "@/lib/api";
import {
  adminAccountsOverlay,
  adminNoticesStore,
  adminReportsStore,
  expireSuspensionIfDue,
  getAdminAiUsageMock,
  getAdminAuditLogsMock,
  getAdminStatsOverviewMock,
  toAdminDetail,
  toAdminNoticeDetail,
  toAdminNoticeRow,
  toAdminReport,
  toAdminReportDetail,
} from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";
import type { operations } from "@/types/api";

import type {
  AdminAccount,
  AdminAccountDetail,
  AdminAccountListQuery,
  AdminAccountPage,
  AdminAuditLogListQuery,
  AdminAuditLogPage,
  AdminNoticeDetail,
  AdminNoticeListQuery,
  AdminNoticePage,
  AdminReport,
  AdminReportDetail,
  AdminReportListQuery,
  AdminReportPage,
  AiUsageStats,
  StatsOverview,
  StatsRangeQuery,
} from "./types";

/**
 * 관리자 통계 로더 — 대시보드가 쓴다.
 *
 * ⚠️ 명세 쿼리(`unit`, `from`, `to`) 는 전부 필수지만 **목 모드에선 범위와 상관없이 같은
 *    시드 데이터를 돌려준다.** 실 BE 로 전환될 때부터 쿼리가 유효해진다. 호출부는 그럼에도
 *    쿼리를 **항상 넘겨야** 한다 — 실 API 로 넘어가는 순간 쿼리 누락이 계약 위반이 되기 때문.
 * ⚠️ 두 엔드포인트 모두 `[관리자]` 전용이라 **로그인 쿠키에서 accessToken 을 꺼내 Authorization
 *    헤더로 넘긴다.** `api()` 는 토큰이 없으면 헤더를 안 붙여서 401 로 실패한다.
 */

type AiFeatureFilter = NonNullable<
  operations["aiUsage"]["parameters"]["query"]["feature"]
>;

function buildQuery(q: StatsRangeQuery, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ unit: q.unit, from: q.from, to: q.to, ...extra });
  return params.toString();
}

async function readAccessToken(): Promise<string | undefined> {
  const name = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
  return (await cookies()).get(name)?.value;
}

export const getStatsOverview = cache(
  async (q: StatsRangeQuery): Promise<StatsOverview> => {
    if (isMock) return getAdminStatsOverviewMock();
    const accessToken = await readAccessToken();
    return api<StatsOverview>(
      `/api/v1/admin/stats/overview?${buildQuery(q)}`,
      { accessToken },
    );
  },
);

export const getAiUsageStats = cache(
  async (
    q: StatsRangeQuery,
    options?: { feature?: AiFeatureFilter },
  ): Promise<AiUsageStats> => {
    if (isMock) return getAdminAiUsageMock();
    const accessToken = await readAccessToken();
    const extra: Record<string, string> = {};
    if (options?.feature) extra.feature = options.feature;
    return api<AiUsageStats>(
      `/api/v1/admin/stats/ai-usage?${buildQuery(q, extra)}`,
      { accessToken },
    );
  },
);

// ===== 회원 관리 =====

/**
 * 관리자 회원 목록 로더. URL 검색 파라미터가 넓어서 호출부에서 **먼저 유효성 정리** 를 끝내고
 * 넘긴다 — 쿼리 유틸은 undefined 값을 자동으로 떨구므로, 선택 안 된 필터가 섞여도 문제 없다.
 */
function listQuery(q: AdminAccountListQuery): string {
  const params = new URLSearchParams();
  if (q.keyword) params.set("keyword", q.keyword);
  if (q.provider) params.set("provider", q.provider);
  if (q.status) params.set("status", q.status);
  if (q.role) params.set("role", q.role);
  if (q.joinedFrom) params.set("joinedFrom", q.joinedFrom);
  if (q.joinedTo) params.set("joinedTo", q.joinedTo);
  if (q.page !== undefined) params.set("page", String(q.page));
  if (q.size !== undefined) params.set("size", String(q.size));
  return params.toString();
}

export const listAdminAccounts = cache(
  async (q: AdminAccountListQuery = {}): Promise<AdminAccountPage> => {
    if (isMock) {
      // 목에선 overlay 와 accounts 를 합성한 뒤 필터·검색·페이지네이션을 여기서 처리.
      const size = q.size ?? 20;
      const page = q.page ?? 0;
      const keyword = (q.keyword ?? "").trim().toLowerCase();

      const joined = accounts
        .map((acc): AdminAccount | null => {
          const rawEntry = adminAccountsOverlay.get(acc.id);
          if (!rawEntry) return null;
          // 조회 직전 만료된 정지를 ACTIVE 로 전환 — 상태 필터가 이후 값을 보게.
          const entry = expireSuspensionIfDue(rawEntry);
          return {
            accountId: acc.id,
            name: acc.name,
            email: acc.email,
            provider: acc.provider,
            role: acc.role,
            status: entry.status,
            suspendedUntil: entry.suspendedUntil ?? undefined,
            createdAt: acc.createdAt,
            lastLoginAt: entry.lastLoginAt ?? undefined,
          };
        })
        .filter((v): v is AdminAccount => v !== null)
        .filter((v) => (q.role ? v.role === q.role : true))
        .filter((v) => (q.status ? v.status === q.status : true))
        .filter((v) => (q.provider ? v.provider === q.provider : true))
        .filter((v) => {
          // 가입일 범위 (yyyy-MM-dd). `createdAt` 이 `yyyy-MM-ddTHH:mm:ssZ` 형식이면 날짜만
          // 떼어 **같은 길이로 맞춰 비교** — 당일 09:00 레코드가 `joinedTo="…11-10"` 에서
          // 밀려나던 문제를 피한다.
          const createdDate = (v.createdAt ?? "").slice(0, 10);
          if (!createdDate) return true;
          if (q.joinedFrom && createdDate < q.joinedFrom) return false;
          if (q.joinedTo && createdDate > q.joinedTo) return false;
          return true;
        })
        .filter((v) => {
          if (!keyword) return true;
          return (
            (v.name ?? "").toLowerCase().includes(keyword) ||
            (v.email ?? "").toLowerCase().includes(keyword)
          );
        });

      const total = joined.length;
      const totalPages = Math.max(1, Math.ceil(total / size));
      const safePage = Math.min(Math.max(0, page), totalPages - 1);
      const content = joined.slice(safePage * size, safePage * size + size);
      return {
        content,
        page: safePage,
        size,
        totalElements: total,
        totalPages,
        hasNext: safePage < totalPages - 1,
      };
    }
    return api<AdminAccountPage>(`/api/v1/admin/accounts?${listQuery(q)}`);
  },
);

export async function getAdminAccountDetail(
  accountId: number,
): Promise<AdminAccountDetail | null> {
  if (isMock) return toAdminDetail(accountId);
  const accessToken = await readAccessToken();
  return api<AdminAccountDetail>(
    `/api/v1/admin/accounts/${accountId}`,
    { accessToken },
  );
}

// ===== 신고 관리 =====

/**
 * 관리자 신고 목록. BE 쿼리 (`status`, `targetType`, `reason`, `page`, `size`) 를 그대로 넘긴다.
 * 목에서는 store 를 전체 읽은 뒤 메모리에서 필터·정렬·페이지네이션을 수행한다 — 접수된 신고를
 * **접수일 내림차순** 으로 정렬해, 오래된 건이 위로 올라오지 않도록 한다.
 */
function reportListQuery(q: AdminReportListQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set("status", q.status);
  if (q.targetType) params.set("targetType", q.targetType);
  if (q.reason) params.set("reason", q.reason);
  if (q.page !== undefined) params.set("page", String(q.page));
  if (q.size !== undefined) params.set("size", String(q.size));
  return params.toString();
}

export const listAdminReports = cache(
  async (q: AdminReportListQuery = {}): Promise<AdminReportPage> => {
    if (isMock) {
      const size = q.size ?? 20;
      const page = q.page ?? 0;

      const filtered = Array.from(adminReportsStore.values())
        .filter((v) => (q.status ? v.status === q.status : true))
        .filter((v) => (q.targetType ? v.targetType === q.targetType : true))
        .filter((v) => (q.reason ? v.reason === q.reason : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((v): AdminReport => toAdminReport(v));

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / size));
      const safePage = Math.min(Math.max(0, page), totalPages - 1);
      const content = filtered.slice(safePage * size, safePage * size + size);
      return {
        content,
        page: safePage,
        size,
        totalElements: total,
        totalPages,
        hasNext: safePage < totalPages - 1,
      };
    }
    const accessToken = await readAccessToken();
    return api<AdminReportPage>(
      `/api/v1/admin/reports?${reportListQuery(q)}`,
      { accessToken },
    );
  },
);

export async function getAdminReportDetail(
  reportId: number,
): Promise<AdminReportDetail | null> {
  if (isMock) return toAdminReportDetail(reportId);
  const accessToken = await readAccessToken();
  return api<AdminReportDetail>(
    `/api/v1/admin/reports/${reportId}`,
    { accessToken },
  );
}

// ===== 감사 로그 =====

function auditLogQuery(q: AdminAuditLogListQuery): string {
  const params = new URLSearchParams();
  if (q.adminId !== undefined) params.set("adminId", String(q.adminId));
  if (q.actionType) params.set("actionType", q.actionType);
  if (q.targetType) params.set("targetType", q.targetType);
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  if (q.page !== undefined) params.set("page", String(q.page));
  if (q.size !== undefined) params.set("size", String(q.size));
  return params.toString();
}

export const listAdminAuditLogs = cache(
  async (q: AdminAuditLogListQuery = {}): Promise<AdminAuditLogPage> => {
    if (isMock) return getAdminAuditLogsMock(q);
    const accessToken = await readAccessToken();
    return api<AdminAuditLogPage>(
      `/api/v1/admin/audit-logs?${auditLogQuery(q)}`,
      { accessToken },
    );
  },
);

// ===== 공지 관리 =====

function noticeListQuery(q: AdminNoticeListQuery): string {
  const params = new URLSearchParams();
  if (q.noticeType) params.set("noticeType", q.noticeType);
  if (q.state) params.set("state", q.state);
  if (q.page !== undefined) params.set("page", String(q.page));
  if (q.size !== undefined) params.set("size", String(q.size));
  return params.toString();
}

export const listAdminNotices = cache(
  async (q: AdminNoticeListQuery = {}): Promise<AdminNoticePage> => {
    if (isMock) {
      const size = q.size ?? 20;
      const page = q.page ?? 0;
      const all = Array.from(adminNoticesStore.values()).map((v) =>
        toAdminNoticeRow(v),
      );
      const filtered = all
        .filter((v) => (q.noticeType ? v.noticeType === q.noticeType : true))
        .filter((v) => (q.state ? v.state === q.state : true))
        // 표시 시작 최신 순 — 타임스탬프로 비교 (문자열 정렬은 `Z` 와 `+09:00` 가 섞이면 실제
        // 시각 순서와 어긋남).
        .sort((a, b) => {
          const sa = Date.parse(a.displayStartsAt ?? "") || 0;
          const sb = Date.parse(b.displayStartsAt ?? "") || 0;
          return sb - sa;
        });
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / size));
      const safePage = Math.min(Math.max(0, page), totalPages - 1);
      const content = filtered.slice(safePage * size, safePage * size + size);
      return {
        content,
        page: safePage,
        size,
        totalElements: total,
        totalPages,
        hasNext: safePage < totalPages - 1,
      };
    }
    const accessToken = await readAccessToken();
    return api<AdminNoticePage>(
      `/api/v1/admin/notices?${noticeListQuery(q)}`,
      { accessToken },
    );
  },
);

export async function getAdminNoticeDetail(
  noticeId: number,
): Promise<AdminNoticeDetail | null> {
  if (isMock) return toAdminNoticeDetail(noticeId);
  const accessToken = await readAccessToken();
  return api<AdminNoticeDetail>(
    `/api/v1/admin/notices/${noticeId}`,
    { accessToken },
  );
}
