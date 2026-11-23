"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";

import { isAuthMock } from "./config";
import { MOCK_ACCOUNT_COOKIE, MOCK_ACCOUNT_IDS } from "./mock-session";
import { getAuthReturnPath } from "./return-path";
import { getSignupAccount } from "./server";
import { storeAuthTokens } from "./session";

export async function completeMockSignupAction(
  ticket: string,
  next: string | undefined,
  _previous: { error?: string },
  data: FormData,
): Promise<{ error?: string }> {
  if (data.get("terms") !== "on" || data.get("privacy") !== "on") return { error: "필수 약관에 동의해 주세요." };
  const parsed = z.string().trim().min(2).max(20).regex(/^[\p{L}\p{M}\p{N} ]+$/u).safeParse(data.get("name"));
  if (!parsed.success) return { error: "이름은 특수문자 없이 2~20자로 입력해 주세요." };
  const account = await getSignupAccount(ticket).catch(() => null);
  if (!account) return { error: "가입 정보가 만료됐어요. 로그인을 다시 시작해 주세요." };
  if (!isAuthMock) {
    try {
      await api("/api/v1/auth/signup", {
        method: "POST", cache: "no-store",
        json: { ticket, name: parsed.data, termsAgreed: true, privacyAgreed: true },
        onResponse: storeAuthTokens,
      });
    } catch (error) {
      return { error: error instanceof ApiError ? error.message : "가입을 완료하지 못했어요. 다시 시도해 주세요." };
    }
    const destination = getAuthReturnPath(next) ?? getAuthReturnPath((await cookies()).get("moa_auth_return")?.value) ?? "/workspaces";
    (await cookies()).delete("moa_auth_return");
    redirect(destination);
  }
  (await cookies()).set(MOCK_ACCOUNT_COOKIE, String(MOCK_ACCOUNT_IDS[account.provider]), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(getAuthReturnPath(next) ?? "/workspaces");
}
