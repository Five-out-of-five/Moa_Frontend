"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";

import { getAuthFailure } from "./auth-failure";
import { isAuthMock } from "./config";
import { getAuthLoginHref } from "./errors";
import { MOCK_ACCOUNT_COOKIE, MOCK_ACCOUNT_IDS } from "./mock-session";
import { getAuthReturnPath } from "./return-path";
import { getSignupAccount } from "./server";
import { storeAuthTokens } from "./session";
import type { SignupResult } from "./signup-model";

export async function completeMockSignupAction(
  ticket: string,
  next: string | undefined,
  _previous: SignupResult,
  data: FormData,
): Promise<SignupResult> {
  if (data.get("terms") !== "on" || data.get("privacy") !== "on") return { error: "필수 약관에 동의해 주세요." };
  const parsed = z.string().trim().min(2).max(20).regex(/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]+$/u).safeParse(data.get("name"));
  if (!parsed.success) return { nameError: "이름은 한글·영문·숫자·공백으로 2~20자 입력해 주세요." };
  const invalidTicketHref = getAuthLoginHref("AUTH_SIGNUP_TICKET_INVALID", undefined, undefined, getAuthReturnPath(next) ?? undefined);
  let account: Awaited<ReturnType<typeof getSignupAccount>>;
  try { account = await getSignupAccount(ticket); }
  catch (error) {
    const failure = getAuthFailure(error);
    if (failure.code === "AUTH_SIGNUP_TICKET_INVALID") redirect(getAuthLoginHref(failure.code, undefined, failure.traceId, getAuthReturnPath(next) ?? undefined));
    return { error: failure.error, traceId: failure.traceId };
  }
  if (!account) redirect(invalidTicketHref);
  if (!isAuthMock) {
    try {
      await api("/api/v1/auth/signup", {
        method: "POST", cache: "no-store",
        json: { ticket, name: parsed.data, termsAgreed: true, privacyAgreed: true },
        onResponse: storeAuthTokens,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SIGNUP_TICKET_INVALID") redirect(getAuthLoginHref(error.code, undefined, error.traceId, getAuthReturnPath(next) ?? undefined));
      const failure = getAuthFailure(error);
      if (failure.redirectTo) redirect(failure.redirectTo);
      const nameError = error instanceof ApiError ? error.fields?.find(({ field }) => field === "name")?.reason : undefined;
      return { error: nameError ? undefined : failure.error, nameError, traceId: failure.traceId };
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
