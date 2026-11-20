import "server-only";

import { cache } from "react";

import { api } from "@/lib/api";
import {
  adminAccountsOverlay,
  adminAiUsageMock,
  adminStatsOverviewMock,
  expireSuspensionIfDue,
  toAdminDetail,
} from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";

import type {
  AdminAccount,
  AdminAccountDetail,
  AdminAccountListQuery,
  AdminAccountPage,
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
 */

function buildQuery(q: StatsRangeQuery, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ unit: q.unit, from: q.from, to: q.to, ...extra });
  return params.toString();
}

export const getStatsOverview = cache(
  async (q: StatsRangeQuery): Promise<StatsOverview> => {
    if (isMock) return adminStatsOverviewMock;
    return api<StatsOverview>(`/api/v1/admin/stats/overview?${buildQuery(q)}`);
  },
);

export const getAiUsageStats = cache(
  async (
    q: StatsRangeQuery,
    options?: { feature?: string },
  ): Promise<AiUsageStats> => {
    if (isMock) return adminAiUsageMock;
    const extra: Record<string, string> = {};
    if (options?.feature) extra.feature = options.feature;
    return api<AiUsageStats>(`/api/v1/admin/stats/ai-usage?${buildQuery(q, extra)}`);
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
          // 가입일 범위 (yyyy-MM-dd). 문자열 비교로 충분 — ISO 날짜라 사전식 순서 = 시간 순서.
          const createdAt = v.createdAt ?? "";
          if (q.joinedFrom && createdAt < q.joinedFrom) return false;
          if (q.joinedTo && createdAt > q.joinedTo) return false;
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
  return api<AdminAccountDetail>(`/api/v1/admin/accounts/${accountId}`);
}
