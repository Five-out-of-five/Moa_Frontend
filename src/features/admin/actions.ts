"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getMyAccount } from "@/features/account/server";
import { api, ApiError } from "@/lib/api";
import { isServiceAdmin } from "@/lib/permission";
import {
  adminAccountsOverlay,
  adminNoticesStore,
  adminReportsStore,
  createNoticeInStore,
  deleteNoticeInStore,
  rejectReportInStore,
  resolveReportInStore,
  reviewReportInStore,
  suspendInOverlay,
  toAdminDetail,
  toAdminNoticeDetail,
  toAdminReportDetail,
  unsuspendInOverlay,
  updateNoticeInStore,
} from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";

import type {
  AdminAccountDetail,
  AdminAccountRole,
  AdminNoticeDetail,
  AdminNoticeRequest,
  AdminReportAction,
  AdminReportDetail,
  AdminSuspensionPeriod,
} from "./types";

/**
 * 관리자 회원 관리 Server Actions.
 *
 * ⚠️ 에러는 **throw 하지 않고** `kind` 로 분기해 돌려준다. 프로덕션 React 가 throw 메시지를
 *    generic 으로 덮어 "알 수 없는 오류" 토스트를 띄우는 일이 반복됐기 때문. 가드 호출 자체도
 *    인증 만료·네트워크 오류로 throw 할 수 있어 **try/catch 안에 넣는다.**
 * ⚠️ 모든 액션이 가드를 한 번 더 돈다. 레이아웃 가드가 있어도 **Server Action 은 별도 요청**
 *    이라 레이아웃을 거치지 않는다. 역할 검증 누락이 가장 흔한 사고 지점.
 * ⚠️ 실 API 모드에서는 **쿠키 accessToken 을 모든 BE 호출에 함께 넘긴다** — 두 관리자 엔드포인트
 *    (`PUT role`, `POST/DELETE suspension`) 가 Bearer 를 전제로 하기 때문.
 */

type Ok<T> = { kind: "ok"; detail: T };
type Guard = { kind: "guard"; message: string };
type Conflict = { kind: "conflict"; message: string };
type Err = { kind: "error"; message: string };
type Result = Ok<AdminAccountDetail> | Guard | Conflict | Err;

async function readAccessToken(): Promise<string | undefined> {
  const name = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
  return (await cookies()).get(name)?.value;
}

async function ensureAdmin(): Promise<
  | { ok: true; adminId: number; displayName: string }
  | { ok: false; guard: Guard }
> {
  const me = await getMyAccount();
  if (!isServiceAdmin(me)) {
    return {
      ok: false,
      guard: { kind: "guard", message: "관리자 권한이 필요합니다." },
    };
  }
  return { ok: true, adminId: me.id, displayName: me.name };
}

function wrapError(e: unknown): Conflict | Err {
  if (e instanceof ApiError) {
    const msg = e.message || "요청을 처리하지 못했습니다.";
    if (e.status === 409 || e.status === 400) {
      return { kind: "conflict", message: msg };
    }
    if (e.status === 401 || e.status === 403) {
      return { kind: "error", message: "로그인이 만료되었거나 권한이 없습니다." };
    }
    return { kind: "error", message: msg };
  }
  return { kind: "error", message: "요청을 처리하지 못했습니다." };
}

export async function changeAccountRoleAction(
  accountId: number,
  nextRole: AdminAccountRole,
): Promise<Result> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    if (guard.adminId === accountId) {
      return {
        kind: "guard",
        message: "본인의 관리자 권한은 스스로 변경할 수 없습니다.",
      };
    }

    if (isMock) {
      const target = accounts.find((a) => a.id === accountId);
      if (!target) return { kind: "error", message: "회원을 찾지 못했습니다." };
      if (target.role === nextRole) {
        return { kind: "conflict", message: "이미 같은 역할입니다." };
      }
      // 관리자 수를 한 명 이하로 떨어뜨리는지 확인 (해제 방향에서만).
      if (target.role === "ADMIN" && nextRole === "USER") {
        const adminCount = accounts.filter((a) => a.role === "ADMIN").length;
        if (adminCount <= 1) {
          return {
            kind: "conflict",
            message: "관리자는 최소 1명 이상 유지해야 합니다.",
          };
        }
      }
      target.role = nextRole;
      const detail = toAdminDetail(accountId);
      revalidatePath("/admin/accounts");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const detail = await api<AdminAccountDetail>(
      `/api/v1/admin/accounts/${accountId}/role?adminId=${guard.adminId}`,
      { method: "PUT", json: { role: nextRole }, accessToken },
    );
    revalidatePath("/admin/accounts");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function suspendAccountAction(
  accountId: number,
  period: AdminSuspensionPeriod,
  reason: string,
  reportId?: number,
): Promise<Result> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    if (guard.adminId === accountId) {
      return { kind: "guard", message: "본인 계정은 정지할 수 없습니다." };
    }

    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      return { kind: "guard", message: "정지 사유를 입력해 주세요." };
    }

    if (isMock) {
      const target = accounts.find((a) => a.id === accountId);
      if (!target) return { kind: "error", message: "회원을 찾지 못했습니다." };
      if (target.role === "ADMIN") {
        return {
          kind: "conflict",
          message: "관리자 계정은 정지할 수 없습니다.",
        };
      }
      const entry = adminAccountsOverlay.get(accountId);
      if (entry?.status === "WITHDRAWN") {
        return { kind: "conflict", message: "탈퇴한 회원은 정지할 수 없습니다." };
      }
      suspendInOverlay(accountId, period, trimmed, {
        accountId: guard.adminId,
        displayName: guard.displayName,
      }, reportId);
      const detail = toAdminDetail(accountId);
      revalidatePath("/admin/accounts");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const payload: Record<string, unknown> = { period, reason: trimmed };
    if (reportId !== undefined) payload.reportId = reportId;
    const detail = await api<AdminAccountDetail>(
      `/api/v1/admin/accounts/${accountId}/suspension?adminId=${guard.adminId}`,
      { method: "POST", json: payload, accessToken },
    );
    revalidatePath("/admin/accounts");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function unsuspendAccountAction(accountId: number): Promise<Result> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    if (isMock) {
      unsuspendInOverlay(accountId);
      const detail = toAdminDetail(accountId);
      revalidatePath("/admin/accounts");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const detail = await api<AdminAccountDetail>(
      `/api/v1/admin/accounts/${accountId}/suspension?adminId=${guard.adminId}`,
      { method: "DELETE", accessToken },
    );
    revalidatePath("/admin/accounts");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

// ===== 신고 관리 Server Actions =====
//
// 상태 전이: RECEIVED ──review──> IN_PROGRESS ──resolve──> RESOLVED
//                                            └─reject───> REJECTED
// 모든 액션이 가드를 재검증하고, 실 API 모드에서는 쿠키 accessToken 을 함께 넘긴다.

type ReportResult = Ok<AdminReportDetail> | Guard | Conflict | Err;

export async function reviewReportAction(reportId: number): Promise<ReportResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    if (isMock) {
      const entry = adminReportsStore.get(reportId);
      if (!entry) return { kind: "error", message: "신고를 찾지 못했습니다." };
      if (entry.status !== "RECEIVED") {
        return { kind: "conflict", message: "이미 처리 중이거나 완료된 신고입니다." };
      }
      reviewReportInStore(reportId, guard.adminId);
      const detail = toAdminReportDetail(reportId);
      revalidatePath("/admin/reports");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const detail = await api<AdminReportDetail>(
      `/api/v1/admin/reports/${reportId}/review?adminId=${guard.adminId}`,
      { method: "POST", accessToken },
    );
    revalidatePath("/admin/reports");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function resolveReportAction(
  reportId: number,
  input: {
    action: AdminReportAction;
    actionReason: string;
    suspensionPeriod?: AdminSuspensionPeriod;
    falseReport?: boolean;
    /**
     * UI 가 들고 있는 피신고자 ID. `SUSPEND_ACCOUNT` 본인 보호 가드에 쓰며, 목 모드에서는
     * store 의 값으로 다시 확인한다. BE 는 reportId 로 자체 검증하되 UI 가 미리 걸러 준다.
     */
    targetAccountId?: number;
  },
): Promise<ReportResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    const reason = input.actionReason.trim();
    if (reason.length === 0) {
      return { kind: "guard", message: "조치 사유를 입력해 주세요." };
    }
    if (input.action === "SUSPEND_ACCOUNT" && !input.suspensionPeriod) {
      return { kind: "guard", message: "계정 정지를 선택하면 정지 기간이 필요합니다." };
    }

    if (isMock) {
      const entry = adminReportsStore.get(reportId);
      if (!entry) return { kind: "error", message: "신고를 찾지 못했습니다." };
      if (entry.status === "RESOLVED" || entry.status === "REJECTED") {
        return { kind: "conflict", message: "이미 처리된 신고입니다." };
      }
      // SUSPEND_ACCOUNT 액션이면 피신고자 상태를 먼저 검증해 "상태만 바뀌고 실제 정지는 생략"
      // 되는 사고를 막는다. 본인/관리자/존재하지 않는 대상은 상태 변경 **전에** 거절.
      if (input.action === "SUSPEND_ACCOUNT" && input.suspensionPeriod) {
        if (entry.targetAccountId === guard.adminId) {
          return { kind: "guard", message: "본인 계정은 정지할 수 없습니다." };
        }
        const target = accounts.find((a) => a.id === entry.targetAccountId);
        if (!target) {
          return { kind: "error", message: "정지할 대상 계정을 찾지 못했습니다." };
        }
        if (target.role === "ADMIN") {
          return { kind: "conflict", message: "관리자 계정은 정지할 수 없습니다." };
        }
        suspendInOverlay(
          entry.targetAccountId,
          input.suspensionPeriod,
          reason,
          { accountId: guard.adminId, displayName: guard.displayName },
          reportId,
        );
      }
      resolveReportInStore(reportId, guard.adminId, {
        action: input.action,
        actionReason: reason,
        falseReport: input.falseReport,
      });
      const detail = toAdminReportDetail(reportId);
      revalidatePath("/admin/reports");
      if (input.action === "SUSPEND_ACCOUNT") revalidatePath("/admin/accounts");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    // 실 API 분기 — 대상 ID 를 모르면 BE 검증에 맡기지만, UI 가 알고 있는 값이 있으면 본인
    // 정지 요청을 사전 차단한다 (BE 가드 누락 대비).
    if (
      input.action === "SUSPEND_ACCOUNT" &&
      input.targetAccountId !== undefined &&
      input.targetAccountId === guard.adminId
    ) {
      return { kind: "guard", message: "본인 계정은 정지할 수 없습니다." };
    }

    const accessToken = await readAccessToken();
    const payload: Record<string, unknown> = {
      action: input.action,
      actionReason: reason,
    };
    if (input.suspensionPeriod) payload.suspensionPeriod = input.suspensionPeriod;
    if (input.falseReport !== undefined) payload.falseReport = input.falseReport;
    const detail = await api<AdminReportDetail>(
      `/api/v1/admin/reports/${reportId}/resolve?adminId=${guard.adminId}`,
      { method: "POST", json: payload, accessToken },
    );
    revalidatePath("/admin/reports");
    if (input.action === "SUSPEND_ACCOUNT") revalidatePath("/admin/accounts");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function rejectReportAction(
  reportId: number,
  input: { actionReason: string; falseReport?: boolean },
): Promise<ReportResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    const reason = input.actionReason.trim();
    if (reason.length === 0) {
      return { kind: "guard", message: "반려 사유를 입력해 주세요." };
    }

    if (isMock) {
      const entry = adminReportsStore.get(reportId);
      if (!entry) return { kind: "error", message: "신고를 찾지 못했습니다." };
      if (entry.status === "RESOLVED" || entry.status === "REJECTED") {
        return { kind: "conflict", message: "이미 처리된 신고입니다." };
      }
      rejectReportInStore(reportId, guard.adminId, {
        actionReason: reason,
        falseReport: input.falseReport,
      });
      const detail = toAdminReportDetail(reportId);
      revalidatePath("/admin/reports");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const payload: Record<string, unknown> = { actionReason: reason };
    if (input.falseReport !== undefined) payload.falseReport = input.falseReport;
    const detail = await api<AdminReportDetail>(
      `/api/v1/admin/reports/${reportId}/reject?adminId=${guard.adminId}`,
      { method: "POST", json: payload, accessToken },
    );
    revalidatePath("/admin/reports");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

// ===== 공지 관리 Server Actions =====
//
// Create/Update 는 `AdminNoticeDetail` 응답을, Delete 는 void 성공을 돌려준다. Delete 는 void
// 성공을 "kind: ok" 로 통일하되 detail 은 비워 둔다 (다른 액션 결과 재사용 금지, UI 쪽에서 한번
// 더 분기).

type NoticeOkDetail = Ok<AdminNoticeDetail>;
type NoticeOkVoid = { kind: "ok-void" };
type NoticeDetailResult = NoticeOkDetail | Guard | Conflict | Err;
type NoticeVoidResult = NoticeOkVoid | Guard | Conflict | Err;

/** 공통 입력 검증 — Create / Update 가 공유. */
function validateNoticeInput(
  input: AdminNoticeRequest,
): Guard | null {
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length === 0) return { kind: "guard", message: "제목을 입력해 주세요." };
  if (content.length === 0) return { kind: "guard", message: "내용을 입력해 주세요." };

  const starts = Date.parse(input.displayStartsAt);
  const ends = Date.parse(input.displayEndsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
    return { kind: "guard", message: "표시 기간이 올바르지 않습니다." };
  }
  if (ends <= starts) {
    return { kind: "guard", message: "표시 종료일이 시작일보다 뒤여야 합니다." };
  }
  if (input.noticeType === "MAINTENANCE" && input.maintenanceStartsAt) {
    const m = Date.parse(input.maintenanceStartsAt);
    if (!Number.isFinite(m)) {
      return { kind: "guard", message: "점검 시작일 형식이 올바르지 않습니다." };
    }
    if (m < starts || m > ends) {
      return {
        kind: "guard",
        message: "점검 시작일은 표시 기간 안에 있어야 합니다.",
      };
    }
  }
  return null;
}

function trimmedInput(input: AdminNoticeRequest): AdminNoticeRequest {
  return {
    ...input,
    title: input.title.trim(),
    content: input.content.trim(),
    // GENERAL/URGENT 는 maintenanceStartsAt 전달 금지
    maintenanceStartsAt:
      input.noticeType === "MAINTENANCE"
        ? input.maintenanceStartsAt
        : undefined,
  };
}

export async function createNoticeAction(
  input: AdminNoticeRequest,
): Promise<NoticeDetailResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    const validation = validateNoticeInput(input);
    if (validation) return validation;
    const payload = trimmedInput(input);

    if (isMock) {
      const entry = createNoticeInStore(guard.adminId, payload);
      const detail = toAdminNoticeDetail(entry.noticeId);
      revalidatePath("/admin/notices");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const detail = await api<AdminNoticeDetail>(
      `/api/v1/admin/notices?adminId=${guard.adminId}`,
      { method: "POST", json: payload, accessToken },
    );
    revalidatePath("/admin/notices");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function updateNoticeAction(
  noticeId: number,
  input: AdminNoticeRequest,
): Promise<NoticeDetailResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    const validation = validateNoticeInput(input);
    if (validation) return validation;
    const payload = trimmedInput(input);

    if (isMock) {
      const entry = updateNoticeInStore(noticeId, payload);
      if (!entry) return { kind: "error", message: "공지를 찾지 못했습니다." };
      const detail = toAdminNoticeDetail(noticeId);
      revalidatePath("/admin/notices");
      if (!detail) return { kind: "error", message: "상세를 다시 불러오지 못했습니다." };
      return { kind: "ok", detail };
    }

    const accessToken = await readAccessToken();
    const detail = await api<AdminNoticeDetail>(
      `/api/v1/admin/notices/${noticeId}?adminId=${guard.adminId}`,
      { method: "PUT", json: payload, accessToken },
    );
    revalidatePath("/admin/notices");
    return { kind: "ok", detail };
  } catch (e) {
    return wrapError(e);
  }
}

export async function deleteNoticeAction(
  noticeId: number,
): Promise<NoticeVoidResult> {
  try {
    const guard = await ensureAdmin();
    if (!guard.ok) return guard.guard;

    if (isMock) {
      if (!adminNoticesStore.has(noticeId)) {
        return { kind: "error", message: "이미 삭제되었거나 존재하지 않는 공지입니다." };
      }
      deleteNoticeInStore(noticeId);
      revalidatePath("/admin/notices");
      return { kind: "ok-void" };
    }

    const accessToken = await readAccessToken();
    await api<void>(
      `/api/v1/admin/notices/${noticeId}?adminId=${guard.adminId}`,
      { method: "DELETE", accessToken },
    );
    revalidatePath("/admin/notices");
    return { kind: "ok-void" };
  } catch (e) {
    return wrapError(e);
  }
}

