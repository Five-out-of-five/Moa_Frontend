/**
 * 관리자 영역 목 데이터 — 실 BE 응답 shape(`StatsOverviewResponse`, `AiUsageStatsResponse`,
 * `PageResponseAuditLogResponse`) 를 그대로 흉내 낸다. 수치는 그럴듯한 추이가 보이도록 손으로
 * 깔아 둔 값.
 *
 * ⚠️ **상수 export 가 아니라 함수 export 다.** 모듈 로드 시점에 날짜를 박아 두면 서버가 자정을
 *    넘어 계속 돌 때 "최근 14일" 범위가 늘어나지 않는다. 호출 시점에 날짜를 생성해 조회 범위와
 *    같은 기준으로 돌려준다 — 집계 값(합계·비용 등) 자체는 그대로 고정.
 * ⚠️ 실 API 전환 시 이 파일은 수정하지 않는다 — `features/admin/server.ts` 의 `isMock`
 *    분기에서 이걸 호출하는 쪽을 바꾸면 끝이다.
 */

import type {
  AdminAuditLogPage,
  AiUsageByFeature,
  AiUsageStats,
  StatsOverview,
  StatsSeriesPoint,
} from "@/features/admin/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Seoul";

function toKstIsoDate(d: Date): string {
  // sv-SE locale → "yyyy-MM-dd HH:mm:ss" 스타일. 날짜만 떼낸다.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function buildSeries(days: number, now: Date): StatsSeriesPoint[] {
  const points: StatsSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short",
    }).format(d);
    const weekend = weekday === "Sat" || weekday === "Sun";
    const base = weekend ? 0.55 : 1;
    points.push({
      periodStart: toKstIsoDate(d),
      newAccounts: Math.round(4 * base + Math.sin(i / 2) * 2 + 2),
      activeAccounts: Math.round(42 * base + Math.cos(i / 3) * 6 + 12),
      newRooms: Math.max(0, Math.round(1.1 * base + Math.sin(i / 4) * 1.4)),
      messages: Math.round(220 * base + Math.sin(i / 2.5) * 70 + 90),
    });
  }
  return points;
}

export function getAdminStatsOverviewMock(): StatsOverview {
  const now = new Date();
  return {
    totals: {
      accounts: 328,
      rooms: 46,
      messages: 18_724,
    },
    series: buildSeries(14, now),
    aggregatedAt: now.toISOString(),
  };
}

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

export function getAdminAiUsageMock(): AiUsageStats {
  const now = new Date();
  return {
    byFeature: AI_FEATURES,
    series: buildSeries(14, now),
    threshold: {
      costAmount: 80,
      exceeded: false,
    },
  };
}

/**
 * 감사 로그 목 — 이슈 #72 "포함 작업" 요구. `AuditLogResponse` 스키마 그대로.
 * 관리자가 방금 한 행동을 역순으로 보여 주도록 `createdAt` 은 요청 시점에서 분 단위로 뒤로 민다.
 */
export function getAdminAuditLogsMock(): AdminAuditLogPage {
  const now = new Date();
  const entries: AdminAuditLogPage["content"] = [
    {
      auditLogId: 1_024,
      admin: { accountId: 1, name: "이홍근" },
      actionType: "ACCOUNT_ROLE_CHANGE",
      targetType: "ACCOUNT",
      targetId: 42,
      detail: "역할 USER → ADMIN",
      ipAddress: "10.0.0.14",
      createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    },
    {
      auditLogId: 1_023,
      admin: { accountId: 1, name: "이홍근" },
      actionType: "ACCOUNT_SUSPEND",
      targetType: "ACCOUNT",
      targetId: 118,
      detail: "7일 정지 · 사유: 반복 신고",
      ipAddress: "10.0.0.14",
      createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    },
    {
      auditLogId: 1_022,
      admin: { accountId: 1, name: "이홍근" },
      actionType: "REPORT_RESOLVE",
      targetType: "REPORT",
      targetId: 904,
      detail: "스팸 메시지 · 제재 완료",
      ipAddress: "10.0.0.14",
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      auditLogId: 1_021,
      admin: { accountId: 1, name: "이홍근" },
      actionType: "ROOM_ARCHIVE",
      targetType: "ROOM",
      targetId: 31,
      detail: "비활성 방 아카이빙",
      ipAddress: "10.0.0.14",
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
  return {
    content: entries,
    page: 0,
    size: 20,
    totalElements: entries.length,
    totalPages: 1,
    hasNext: false,
  };
}
