/**
 * 관리자 영역 목 데이터 — 실 BE 응답 shape 를 그대로 흉내 낸다. 수치/시드는 손으로 깔아 둔 값.
 *
 * ⚠️ 실 API 전환 시 이 파일은 수정하지 않는다 — `features/admin/server.ts`·`actions.ts` 의
 *    `isMock` 분기에서 이걸 호출하는 쪽을 바꾸면 끝이다.
 */

import type {
  AdminAccountDetail,
  AdminAccountStatus,
  AdminSuspension,
  AdminSuspensionPeriod,
  AiUsageByFeature,
  AiUsageStats,
  StatsOverview,
  StatsSeriesPoint,
} from "@/features/admin/types";
import { accounts, shareSettingsMock } from "@/mocks/db";

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

// ===== 회원 관리 overlay =====
//
// BE 가 돌면 하나의 서버가 정답이지만, 목 모드에서는 `accounts` 와 "관리자 뷰에서 추가로
// 보는 필드(status/suspension/lastLoginAt/roomCount)" 사이에 drift 가 생길 수 있다.
// 그래서 overlay 를 별도 Map 으로 두되 **accounts 를 유일 신분 원본** 으로 삼고,
// listAdminAccounts/getAdminAccountDetail 가 매 호출마다 overlay 와 합성해 돌려준다.
// `shareSettingsMock` 로 globalThis 에 올려 Server Action 과 라우트가 같은 Map 을 본다.

export interface AdminOverlayEntry {
  status: AdminAccountStatus;
  suspendedUntil: string | null;
  lastLoginAt: string | null;
  roomCount: number;
  ownedRoomCount: number;
  reportBlockedUntil: string | null;
  suspensions: AdminSuspension[];
}

const DAY_MS_IN_HOURS = 24 * 60 * 60 * 1000;

function seedOverlay(): Map<number, AdminOverlayEntry> {
  const m = new Map<number, AdminOverlayEntry>();
  accounts.forEach((acc, i) => {
    const loggedDaysAgo = (i * 3 + 1) % 17;
    m.set(acc.id, {
      status: "ACTIVE",
      suspendedUntil: null,
      lastLoginAt: new Date(Date.now() - loggedDaysAgo * DAY_MS_IN_HOURS).toISOString(),
      roomCount: Math.max(1, (i * 2) % 5),
      ownedRoomCount: i % 2,
      reportBlockedUntil: null,
      suspensions: [],
    });
  });
  return m;
}

export const adminAccountsOverlay = shareSettingsMock(
  "adminAccountsOverlay",
  seedOverlay(),
);

/** 정지 기간 enum → 밀리초. BE 가 실제 종료일을 돌려주므로 목에서만 쓰는 매핑. */
const PERIOD_MS: Record<AdminSuspensionPeriod, number | null> = {
  DAYS_3: 3 * DAY_MS_IN_HOURS,
  DAYS_7: 7 * DAY_MS_IN_HOURS,
  DAYS_30: 30 * DAY_MS_IN_HOURS,
  PERMANENT: null,
};

export function suspendInOverlay(
  accountId: number,
  period: AdminSuspensionPeriod,
  reason: string,
  adminRef: { accountId: number; displayName: string },
  reportId?: number,
): void {
  const entry = adminAccountsOverlay.get(accountId);
  if (!entry) throw new Error(`overlay entry missing for account ${accountId}`);
  const now = new Date();
  const ms = PERIOD_MS[period];
  const endsAt =
    ms === null ? null : new Date(now.getTime() + ms).toISOString();
  const suspension: AdminSuspension = {
    suspensionId: Date.now(),
    period,
    reason,
    startedAt: now.toISOString(),
    endsAt: endsAt ?? undefined,
    admin: {
      accountId: adminRef.accountId,
      displayName: adminRef.displayName,
      // AdminRef 추가 필드는 미사용
    } as AdminSuspension["admin"],
  };
  // reportId 가 BE 스키마엔 Suspension 에 없지만 SuspendRequest 엔 있어서 로그로만 남긴다.
  void reportId;
  entry.status = "SUSPENDED";
  entry.suspendedUntil = endsAt;
  entry.suspensions = [suspension, ...entry.suspensions];
}

export function unsuspendInOverlay(accountId: number): void {
  const entry = adminAccountsOverlay.get(accountId);
  if (!entry) throw new Error(`overlay entry missing for account ${accountId}`);
  if (entry.status !== "SUSPENDED") return;
  const now = new Date().toISOString();
  entry.status = "ACTIVE";
  entry.suspendedUntil = null;
  if (entry.suspensions[0] && !entry.suspensions[0].releasedAt) {
    entry.suspensions[0] = { ...entry.suspensions[0], releasedAt: now };
  }
}

export function toAdminDetail(
  accountId: number,
): AdminAccountDetail | null {
  const acc = accounts.find((a) => a.id === accountId);
  const entry = adminAccountsOverlay.get(accountId);
  if (!acc || !entry) return null;
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
    roomCount: entry.roomCount,
    ownedRoomCount: entry.ownedRoomCount,
    reportBlockedUntil: entry.reportBlockedUntil ?? undefined,
    suspensions: entry.suspensions,
  };
}
