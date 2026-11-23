"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { isAuthMock } from "@/features/auth/config";
import { MOCK_ACCOUNT_COOKIE } from "@/features/auth/mock-session";
import { authCookieHeaders, clearAuthTokens, relayRefreshCookie } from "@/features/auth/session";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import { getMyAccount, getWithdrawalCheck } from "./server";
import type { SettingsResult, WithdrawalResult } from "./settings-types";

const nameSchema = z
  .string()
  .trim()
  .min(2, "이름을 2자 이상 입력해 주세요.")
  .max(20, "이름은 20자까지 입력할 수 있습니다.")
  .regex(/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]+$/, "이름은 한글, 영문, 숫자, 공백만 입력할 수 있습니다.");

export async function updateAccountNameAction(
  _previous: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) {
    return { success: false, message: "", nameError: name.error.issues[0].message };
  }
  let savedName = name.data;
  try {
    if (isMock) (await getMyAccount()).name = savedName;
    else {
      const account = await api<components["schemas"]["MyAccountResponse"]>("/api/v1/accounts/me", {
        method: "PATCH", json: { name: savedName }, cache: "no-store",
      });
      savedName = account.name ?? savedName;
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      const nameError = error.fields?.find(({ field }) => field === "name")?.reason;
      return { success: false, message: nameError ? "" : error.message, nameError };
    }
    return { success: false, message: "기본 이름을 저장하지 못했습니다." };
  }
  revalidatePath("/", "layout");
  return { success: true, message: "기본 이름을 저장했습니다.", name: savedName };
}

export async function checkWithdrawalAction(): Promise<WithdrawalResult> {
  try {
    return { check: await getWithdrawalCheck() };
  } catch (error) {
    unstable_rethrow(error);
    return { message: error instanceof ApiError ? error.message : "탈퇴 가능 여부를 확인하지 못했습니다." };
  }
}

export async function withdrawAccountAction(
  _: WithdrawalResult,
  formData: FormData,
): Promise<WithdrawalResult> {
  if (isMock) return { message: "목 모드에서는 계정을 탈퇴할 수 없습니다." };
  const confirmText = formData.get("confirmText");
  if (confirmText !== "탈퇴합니다") return { confirmError: "탈퇴합니다를 정확히 입력해 주세요." };
  let hasDeletionCookie = false;
  try {
    await api("/api/v1/accounts/me", {
      method: "DELETE",
      cache: "no-store",
      json: { confirmText },
      headers: await authCookieHeaders(),
      onResponse: async (_, headers) => {
        await relayRefreshCookie(headers);
        hasDeletionCookie = headers.getSetCookie().some((cookie) => /^refreshToken=/i.test(cookie) && /;\s*Max-Age=0(?:;|$)/i.test(cookie));
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.code === "ACCOUNT_OWNED_ROOM_EXISTS") return checkWithdrawalAction();
    if (error instanceof ApiError && error.code === "ACCOUNT_WITHDRAW_CONFIRM_MISMATCH") return { confirmError: error.message };
    return { message: error instanceof ApiError ? error.message : "계정을 탈퇴하지 못했습니다." };
  }
  (await cookies()).delete(MOCK_ACCOUNT_COOKIE);
  await clearAuthTokens(!hasDeletionCookie);
  redirect("/");
}

/**
 * 로그아웃 — 프로필 드롭다운에서 부른다.
 *
 * ⚠️ 목 모드에선 세션 개념이 없어 바로 /login 으로 보낸다. BE 가 붙으면 쿠키를 무효화하는
 *    `POST /auth/logout` 을 거친다.
 */
export async function logoutAction() {
  let hasDeletionCookie = false;
  (await cookies()).delete(MOCK_ACCOUNT_COOKIE);
  if (!isAuthMock) {
    try {
      await api("/api/v1/auth/logout", { method: "POST", cache: "no-store", headers: await authCookieHeaders(), onHeaders: async (headers) => {
        await relayRefreshCookie(headers);
        hasDeletionCookie = headers.getSetCookie().some((cookie) => /^refreshToken=/i.test(cookie) && /;\s*Max-Age=0(?:;|$)/i.test(cookie));
      } });
    } catch {
      // 실패해도 클라이언트 세션은 비워 로그인 화면으로 보낸다.
    }
  }
  await clearAuthTokens(!hasDeletionCookie);
  redirect("/login");
}
