/**
 * 관리자 영역 목 데이터 — 실 BE 응답 shape(`StatsOverviewResponse`, `AiUsageStatsResponse`)
 * 를 그대로 흉내 낸다. 수치는 그럴듯한 추이가 보이도록 손으로 깔아 둔 값.
 *
 * ⚠️ 실 API 전환 시 이 파일은 수정하지 않는다 — `features/admin/server.ts` 의 `isMock`
 *    분기에서 이걸 호출하는 쪽을 바꾸면 끝이다.
 */

import type {
  AiUsageByFeature,
  AiUsageStats,
  StatsOverview,
  StatsSeriesPoint,
} from "@/features/admin/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSeries(days: number): StatsSeriesPoint[] {
  const today = new Date();
  // 날짜만 쓰므로 UTC 기준 자정으로 고정 — 로컬 TZ 에 따라 series 길이가 어긋나지 않게.
  today.setUTCHours(0, 0, 0, 0);
  const points: StatsSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const base = weekend ? 0.55 : 1;
    points.push({
      periodStart: toIsoDate(d),
      newAccounts: Math.round(4 * base + Math.sin(i / 2) * 2 + 2),
      activeAccounts: Math.round(42 * base + Math.cos(i / 3) * 6 + 12),
      newRooms: Math.max(0, Math.round(1.1 * base + Math.sin(i / 4) * 1.4)),
      messages: Math.round(220 * base + Math.sin(i / 2.5) * 70 + 90),
    });
  }
  return points;
}

export const adminStatsOverviewMock: StatsOverview = {
  totals: {
    accounts: 328,
    rooms: 46,
    messages: 18_724,
  },
  series: buildSeries(14),
  aggregatedAt: new Date().toISOString(),
};

const AI_FEATURES: AiUsageByFeature[] = [
  {
    feature: "ASSISTANT",
    calls: 1_204,
    failedCalls: 18,
    promptTokens: 684_120,
    outputTokens: 212_540,
    costAmount: 32.74,
  },
  {
    feature: "SUMMARY",
    calls: 318,
    failedCalls: 4,
    promptTokens: 192_040,
    outputTokens: 64_320,
    costAmount: 9.86,
  },
  {
    feature: "CONFLICT",
    calls: 72,
    failedCalls: 1,
    promptTokens: 48_860,
    outputTokens: 12_410,
    costAmount: 2.31,
  },
  {
    feature: "COMPROMISE",
    calls: 38,
    failedCalls: 0,
    promptTokens: 24_180,
    outputTokens: 7_320,
    costAmount: 1.42,
  },
  {
    feature: "TONE",
    calls: 486,
    failedCalls: 3,
    promptTokens: 214_600,
    outputTokens: 42_080,
    costAmount: 7.21,
  },
  {
    feature: "LAYOUT",
    calls: 94,
    failedCalls: 1,
    promptTokens: 68_200,
    outputTokens: 18_940,
    costAmount: 2.84,
  },
];

export const adminAiUsageMock: AiUsageStats = {
  byFeature: AI_FEATURES,
  series: buildSeries(14),
  threshold: {
    costAmount: 80,
    exceeded: false,
  },
};
