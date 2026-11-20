"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getMyAccount } from "@/features/account/server";
import { api, ApiError } from "@/lib/api";
import { isServiceAdmin } from "@/lib/permission";
import {
  adminAccountsOverlay,
  suspendInOverlay,
  toAdminDetail,
  unsuspendInOverlay,
} from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";

import type {
  AdminAccountDetail,
  AdminAccountRole,
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
