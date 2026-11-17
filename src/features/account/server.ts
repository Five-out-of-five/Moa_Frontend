import "server-only";

import { cookies } from "next/headers";

import { MOCK_ACCOUNT_COOKIE, MOCK_ACCOUNT_IDS } from "@/features/auth/mock-session";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";
import type { Account } from "@/types/db";

/**
 * 로그인된 내 계정 — 헤더 프로필 드롭다운, 계정 페이지 등이 부른다.
 *
 * 목 로그인 후에는 선택한 데모 계정을 사용한다. 기존 로컬 화면은 기본 계정으로 열린다.
 */
export async function getMyAccount(): Promise<Account> {
  if (isMock) {
    const me = (await getExplicitMockAccount()) ?? accounts[0];
    if (!me) throw new Error("mock accounts[0] 가 비어 있다 — 시드를 확인하세요.");
    return me;
  }
  return api<Account>("/api/v1/me");
}

export async function getExplicitMockAccount() {
  if (!isMock) return null;
  const id = Number((await cookies()).get(MOCK_ACCOUNT_COOKIE)?.value);
  if (!Object.values(MOCK_ACCOUNT_IDS).some((accountId) => accountId === id)) return null;
  return accounts.find((account) => account.id === id) ?? null;
}

export function canUpdateAccountName() {
  return isMock;
}
