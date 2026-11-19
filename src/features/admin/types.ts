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

/** 기간 집계 단위 — BE 쿼리 파라미터 `unit` 값. */
export type StatsUnit = "DAY" | "WEEK" | "MONTH";

export interface StatsRangeQuery {
  unit: StatsUnit;
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
}
