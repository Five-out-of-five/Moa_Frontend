import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { api } from "@/lib/api";
import { getAdminAiUsageMock, getAdminStatsOverviewMock } from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import type { operations } from "@/types/api";

import type { AiUsageStats, StatsOverview, StatsRangeQuery } from "./types";

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
