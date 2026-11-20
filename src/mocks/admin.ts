/**
 * 관리자 영역 목 데이터 — 실 BE 응답 shape(`StatsOverviewResponse`, `AiUsageStatsResponse`,
 * `PageResponseAuditLogResponse`, `AdminAccountResponse`, `AdminAccountDetailResponse`) 를
 * 그대로 흉내 낸다. 수치/시드는 그럴듯한 추이가 보이도록 손으로 깔아 둔 값.
 *
 * ⚠️ **통계 목은 상수 export 가 아니라 함수 export 다.** 모듈 로드 시점에 날짜를 박아 두면
 *    서버가 자정을 넘어 계속 돌 때 "최근 14일" 범위가 늘어나지 않는다. 호출 시점에 날짜를 생성해
 *    조회 범위와 같은 기준으로 돌려준다 — 집계 값(합계·비용 등) 자체는 그대로 고정.
 * ⚠️ 회원 관리 overlay 는 `shareSettingsMock` 로 globalThis 에 올려 Server Action 과 라우트가
 *    같은 Map 을 본다. 정지 처리 후 다른 요청에서도 바로 보이도록.
 * ⚠️ 실 API 전환 시 이 파일은 수정하지 않는다 — `features/admin/server.ts`·`actions.ts` 의
 *    `isMock` 분기에서 이걸 호출하는 쪽을 바꾸면 끝이다.
 */

import type {
  AdminAccountDetail,
  AdminAccountStatus,
  AdminAuditLogListQuery,
  AdminAuditLogPage,
  AdminReport,
  AdminReportAction,
  AdminReportDetail,
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
  AdminSuspension,
  AdminSuspensionPeriod,
  AiUsageByFeature,
  AiUsageStats,
  StatsOverview,
  StatsSeriesPoint,
} from "@/features/admin/types";
import { accounts, shareSettingsMock } from "@/mocks/db";

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
 * 감사 로그 목 — `AuditLogResponse` 스키마 그대로. 요청 시점을 기준으로 상대 시각을 쌓아
 * "방금 한 행동이 맨 위" 가 되도록 돌려준다. 필터 (`actionType`, `targetType`, `from`, `to`,
 * `adminId`) 와 페이지네이션은 메모리에서 수행.
 *
 * ⚠️ 날짜 범위는 `from`/`to` 모두 `yyyy-MM-dd` 문자열. `createdAt` 의 날짜 부분으로 비교해
 *    당일 레코드가 상한 밖으로 밀리지 않게.
 */

type AuditLogEntry = NonNullable<AdminAuditLogPage["content"]>[number];

/**
 * 시드 — 요청 시점 기준 상대 분(minutes-ago) 으로 각 로그 시각을 계산해 "지금으로부터 X 분 전"
 * 처럼 보이게 한다. 운영자가 방금 한 액션이 맨 위로 노출됨.
 */
const AUDIT_SEED_INPUT: {
  auditLogId: number;
  minutesAgo: number;
  adminId: number;
  adminName: string;
  actionType: string;
  targetType: string;
  targetId: number;
  detail: string;
  ipAddress: string;
}[] = [
  { auditLogId: 1_024, minutesAgo: 5, adminId: 1, adminName: "이홍근", actionType: "ACCOUNT_ROLE_CHANGE", targetType: "ACCOUNT", targetId: 4, detail: "역할 USER → ADMIN", ipAddress: "10.0.0.14" },
  { auditLogId: 1_023, minutesAgo: 45, adminId: 1, adminName: "이홍근", actionType: "ACCOUNT_SUSPEND", targetType: "ACCOUNT", targetId: 5, detail: "7일 정지 · 사유: 반복 신고", ipAddress: "10.0.0.14" },
  { auditLogId: 1_022, minutesAgo: 180, adminId: 1, adminName: "이홍근", actionType: "REPORT_RESOLVE", targetType: "REPORT", targetId: 103, detail: "개인정보 포함 댓글 삭제", ipAddress: "10.0.0.14" },
  { auditLogId: 1_021, minutesAgo: 360, adminId: 1, adminName: "이홍근", actionType: "ROOM_ARCHIVE", targetType: "ROOM", targetId: 31, detail: "비활성 방 아카이빙", ipAddress: "10.0.0.14" },
  { auditLogId: 1_020, minutesAgo: 1_440, adminId: 1, adminName: "이홍근", actionType: "REPORT_REJECT", targetType: "REPORT", targetId: 104, detail: "커뮤니티 공지 범위 내 판단", ipAddress: "10.0.0.14" },
  { auditLogId: 1_019, minutesAgo: 1_680, adminId: 1, adminName: "이홍근", actionType: "NOTICE_CREATE", targetType: "NOTICE", targetId: 51, detail: "정기 점검 공지", ipAddress: "10.0.0.14" },
  { auditLogId: 1_018, minutesAgo: 2_880, adminId: 1, adminName: "이홍근", actionType: "ACCOUNT_UNSUSPEND", targetType: "ACCOUNT", targetId: 6, detail: "3일 정지 종료 자동 해제", ipAddress: "10.0.0.14" },
  { auditLogId: 1_017, minutesAgo: 4_320, adminId: 1, adminName: "이홍근", actionType: "REPORT_REVIEW", targetType: "REPORT", targetId: 102, detail: "담당자 지정", ipAddress: "10.0.0.14" },
  { auditLogId: 1_016, minutesAgo: 5_760, adminId: 1, adminName: "이홍근", actionType: "NOTICE_UPDATE", targetType: "NOTICE", targetId: 48, detail: "채팅 전송 지연 공지 수정", ipAddress: "10.0.0.14" },
  { auditLogId: 1_015, minutesAgo: 10_080, adminId: 1, adminName: "이홍근", actionType: "ROOM_DELETE", targetType: "ROOM", targetId: 22, detail: "오너 요청으로 영구 삭제", ipAddress: "10.0.0.14" },
];

export function getAdminAuditLogsMock(q: AdminAuditLogListQuery = {}): AdminAuditLogPage {
  const now = Date.now();
  const size = q.size ?? 20;
  const page = q.page ?? 0;

  const all: AuditLogEntry[] = AUDIT_SEED_INPUT.map((s) => ({
    auditLogId: s.auditLogId,
    admin: { accountId: s.adminId, name: s.adminName },
    actionType: s.actionType,
    targetType: s.targetType,
    targetId: s.targetId,
    detail: s.detail,
    ipAddress: s.ipAddress,
    createdAt: new Date(now - s.minutesAgo * 60 * 1000).toISOString(),
  }));

  const filtered = all
    .filter((v) => (q.adminId ? v.admin?.accountId === q.adminId : true))
    .filter((v) => (q.actionType ? v.actionType === q.actionType : true))
    .filter((v) => (q.targetType ? v.targetType === q.targetType : true))
    .filter((v) => {
      const createdDate = (v.createdAt ?? "").slice(0, 10);
      if (!createdDate) return true;
      if (q.from && createdDate < q.from) return false;
      if (q.to && createdDate > q.to) return false;
      return true;
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

function seedOverlay(): Map<number, AdminOverlayEntry> {
  const m = new Map<number, AdminOverlayEntry>();
  accounts.forEach((acc, i) => {
    const loggedDaysAgo = (i * 3 + 1) % 17;
    m.set(acc.id, {
      status: "ACTIVE",
      suspendedUntil: null,
      lastLoginAt: new Date(Date.now() - loggedDaysAgo * DAY_MS).toISOString(),
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
  DAYS_3: 3 * DAY_MS,
  DAYS_7: 7 * DAY_MS,
  DAYS_30: 30 * DAY_MS,
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

/**
 * 기간이 지난 정지를 ACTIVE 로 자동 전환. 조회 경로 (상세·목록) 가 돌려주기 직전에 한 번 거쳐야
 * "정지 기간이 끝나면 자동으로 정상 전환" 안내와 실제 상태가 어긋나지 않는다. PERMANENT 와 아직
 * 끝나지 않은 정지는 그대로.
 */
export function expireSuspensionIfDue(entry: AdminOverlayEntry): AdminOverlayEntry {
  if (entry.status !== "SUSPENDED") return entry;
  if (!entry.suspendedUntil) return entry; // PERMANENT
  if (Date.parse(entry.suspendedUntil) > Date.now()) return entry;
  const now = new Date().toISOString();
  entry.status = "ACTIVE";
  entry.suspendedUntil = null;
  if (entry.suspensions[0] && !entry.suspensions[0].releasedAt) {
    entry.suspensions[0] = { ...entry.suspensions[0], releasedAt: now };
  }
  return entry;
}

export function toAdminDetail(
  accountId: number,
): AdminAccountDetail | null {
  const acc = accounts.find((a) => a.id === accountId);
  const rawEntry = adminAccountsOverlay.get(accountId);
  if (!acc || !rawEntry) return null;
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
    roomCount: entry.roomCount,
    ownedRoomCount: entry.ownedRoomCount,
    reportBlockedUntil: entry.reportBlockedUntil ?? undefined,
    suspensions: entry.suspensions,
  };
}

// ===== 신고 관리 =====
//
// 접수된 신고를 Map 으로 들고, review/resolve/reject 액션이 상태 전이를 반영한다. 회원 overlay
// 와 마찬가지로 `shareSettingsMock` 로 globalThis 에 올려 라우트와 Server Action 이 같은 저장소를
// 공유한다. BE 로 넘어가면 이 Map 은 사용되지 않는다.

/** overdue 판정 기준 — RECEIVED 상태로 이 시간 이상 지나면 `overdue: true`. */
const REPORT_OVERDUE_MS = 72 * 60 * 60 * 1000;

export interface AdminReportEntry {
  reportId: number;
  targetType: AdminReportTargetType;
  reason: AdminReportReason;
  status: AdminReportStatus;
  reporterAccountId: number;
  targetAccountId: number;
  roomId: number;
  roomName: string;
  detail: string;
  snapshot: string;
  targetDeleted: boolean;
  createdAt: string;
  action: AdminReportAction | null;
  actionReason: string | null;
  handledByAccountId: number | null;
  handledAt: string | null;
  falseReport: boolean;
}

const REPORT_SEED: Omit<AdminReportEntry, "createdAt">[] = [
  {
    reportId: 101,
    targetType: "MESSAGE",
    reason: "ABUSE",
    status: "RECEIVED",
    reporterAccountId: 2,
    targetAccountId: 4,
    roomId: 1,
    roomName: "모아 — 디자인 리뷰",
    detail: "채팅에서 반복적으로 비방 표현을 사용합니다.",
    snapshot: "이거 완전 쓰레기네 다시 해 와",
    targetDeleted: false,
    action: null,
    actionReason: null,
    handledByAccountId: null,
    handledAt: null,
    falseReport: false,
  },
  {
    reportId: 102,
    targetType: "CARD",
    reason: "INAPPROPRIATE_FILE",
    status: "IN_PROGRESS",
    reporterAccountId: 3,
    targetAccountId: 5,
    roomId: 2,
    roomName: "모아 — 백엔드 스터디",
    detail: "아이디어 카드에 성인물 이미지가 첨부되었습니다.",
    snapshot: "[사진] NSFW_image_01.png",
    targetDeleted: false,
    action: null,
    actionReason: null,
    handledByAccountId: 1,
    handledAt: null,
    falseReport: false,
  },
  {
    reportId: 103,
    targetType: "COMMENT",
    reason: "PRIVACY",
    status: "RESOLVED",
    reporterAccountId: 4,
    targetAccountId: 6,
    roomId: 3,
    roomName: "모아 — 운영팀",
    detail: "제 전화번호가 댓글에 노출되었습니다.",
    snapshot: "010-****-**** 로 연락 주세요",
    targetDeleted: true,
    action: "DELETE_CONTENT",
    actionReason: "개인정보 포함된 댓글을 삭제했습니다.",
    handledByAccountId: 1,
    handledAt: null,
    falseReport: false,
  },
  {
    reportId: 104,
    targetType: "MESSAGE",
    reason: "SPAM",
    status: "REJECTED",
    reporterAccountId: 5,
    targetAccountId: 7,
    roomId: 4,
    roomName: "모아 — 마케팅",
    detail: "채팅에서 광고 메시지를 반복 전송합니다.",
    snapshot: "할인 이벤트 클릭!",
    targetDeleted: false,
    action: null,
    actionReason: "커뮤니티 공지 범위 내로 판단되어 반려했습니다.",
    handledByAccountId: 1,
    handledAt: null,
    falseReport: true,
  },
  {
    reportId: 105,
    targetType: "CARD",
    reason: "ETC",
    status: "RECEIVED",
    reporterAccountId: 6,
    targetAccountId: 8,
    roomId: 5,
    roomName: "모아 — 디자인 리뷰",
    detail: "저작권이 불분명한 이미지가 보드에 공유됩니다.",
    snapshot: "[이미지] figma_export.png",
    targetDeleted: false,
    action: null,
    actionReason: null,
    handledByAccountId: null,
    handledAt: null,
    falseReport: false,
  },
];

function seedReports(): Map<number, AdminReportEntry> {
  const m = new Map<number, AdminReportEntry>();
  const now = Date.now();
  REPORT_SEED.forEach((s, i) => {
    // 가장 오래된 건부터 72시간 전, 나머지는 균등 간격 — 첫 번째가 overdue 상태가 되도록.
    const ageHours = (REPORT_SEED.length - i) * 30 + 6;
    const createdAt = new Date(now - ageHours * 60 * 60 * 1000).toISOString();
    // RESOLVED/REJECTED 는 접수 뒤 ~5시간 뒤 처리된 것처럼.
    const handledAt =
      s.status === "RESOLVED" || s.status === "REJECTED"
        ? new Date(new Date(createdAt).getTime() + 5 * 60 * 60 * 1000).toISOString()
        : s.handledAt;
    m.set(s.reportId, { ...s, createdAt, handledAt });
  });
  return m;
}

export const adminReportsStore = shareSettingsMock(
  "adminReportsStore",
  seedReports(),
);

function personByAccountId(
  accountId: number | null,
): { accountId?: number; name?: string } | undefined {
  if (accountId === null) return undefined;
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return { accountId };
  return { accountId: acc.id, name: acc.name };
}

function isOverdue(entry: AdminReportEntry): boolean {
  if (entry.status !== "RECEIVED") return false;
  return Date.now() - Date.parse(entry.createdAt) >= REPORT_OVERDUE_MS;
}

export function toAdminReport(entry: AdminReportEntry): AdminReport {
  return {
    reportId: entry.reportId,
    targetType: entry.targetType,
    reason: entry.reason,
    status: entry.status,
    reporter: personByAccountId(entry.reporterAccountId),
    targetAccount: personByAccountId(entry.targetAccountId),
    room: { roomId: entry.roomId, name: entry.roomName },
    createdAt: entry.createdAt,
    overdue: isOverdue(entry),
  };
}

export function toAdminReportDetail(reportId: number): AdminReportDetail | null {
  const entry = adminReportsStore.get(reportId);
  if (!entry) return null;
  return {
    reportId: entry.reportId,
    targetType: entry.targetType,
    reason: entry.reason,
    status: entry.status,
    reporter: personByAccountId(entry.reporterAccountId),
    targetAccount: personByAccountId(entry.targetAccountId),
    room: { roomId: entry.roomId, name: entry.roomName },
    createdAt: entry.createdAt,
    overdue: isOverdue(entry),
    detail: entry.detail,
    snapshot: entry.snapshot,
    targetDeleted: entry.targetDeleted,
    action: entry.action ?? undefined,
    actionReason: entry.actionReason ?? undefined,
    handledBy: entry.handledByAccountId !== null
      ? personByAccountId(entry.handledByAccountId)
      : undefined,
    handledAt: entry.handledAt ?? undefined,
  };
}

export function reviewReportInStore(reportId: number, adminId: number): AdminReportEntry | null {
  const entry = adminReportsStore.get(reportId);
  if (!entry) return null;
  if (entry.status !== "RECEIVED") return entry; // 멱등
  entry.status = "IN_PROGRESS";
  entry.handledByAccountId = adminId;
  return entry;
}

export interface ResolveReportInput {
  action: AdminReportAction;
  actionReason: string;
  falseReport?: boolean;
}

export function resolveReportInStore(
  reportId: number,
  adminId: number,
  input: ResolveReportInput,
): AdminReportEntry | null {
  const entry = adminReportsStore.get(reportId);
  if (!entry) return null;
  entry.status = "RESOLVED";
  entry.action = input.action;
  entry.actionReason = input.actionReason;
  entry.falseReport = input.falseReport ?? false;
  entry.handledByAccountId = adminId;
  entry.handledAt = new Date().toISOString();
  if (input.action === "DELETE_CONTENT") entry.targetDeleted = true;
  return entry;
}

export interface RejectReportInput {
  actionReason: string;
  falseReport?: boolean;
}

export function rejectReportInStore(
  reportId: number,
  adminId: number,
  input: RejectReportInput,
): AdminReportEntry | null {
  const entry = adminReportsStore.get(reportId);
  if (!entry) return null;
  entry.status = "REJECTED";
  entry.action = null;
  entry.actionReason = input.actionReason;
  entry.falseReport = input.falseReport ?? false;
  entry.handledByAccountId = adminId;
  entry.handledAt = new Date().toISOString();
  return entry;
}
