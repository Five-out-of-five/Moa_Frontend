"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";

import { getMyAccount } from "./server";
import type { SettingsResult } from "./settings-types";

const nameSchema = z
  .string()
  .trim()
  .min(2, "이름을 2자 이상 입력해 주세요.")
  .max(20, "이름은 20자까지 입력할 수 있습니다.")
  .regex(/^[\p{L}\p{M}\p{N} ]+$/u, "이름에 특수문자를 사용할 수 없습니다.");

export async function updateAccountNameAction(
  _previous: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) {
    return { success: false, message: "", nameError: name.error.issues[0].message };
  }
  if (!isMock) {
    return { success: false, message: "현재 환경에서는 기본 이름을 수정할 수 없습니다." };
  }
  const account = await getMyAccount();
  account.name = name.data;
  revalidatePath("/", "layout");
  return { success: true, message: "기본 이름을 저장했습니다." };
}

/**
 * 로그아웃 — 프로필 드롭다운에서 부른다.
 *
 * ⚠️ 목 모드에선 세션 개념이 없어 바로 /login 으로 보낸다. BE 가 붙으면 쿠키를 무효화하는
 *    `POST /auth/logout` 을 거친다.
 */
export async function logoutAction() {
  if (!isMock) {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // 실패해도 클라이언트 세션은 비워 로그인 화면으로 보낸다.
    }
  }
  redirect("/login");
}
