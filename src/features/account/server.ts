import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { isAuthMock } from "@/features/auth/config";
import { requireAuthSession } from "@/features/auth/guard";
import { MOCK_ACCOUNT_COOKIE, MOCK_ACCOUNT_IDS } from "@/features/auth/mock-session";
import { listMyRoomsForSettings } from "@/features/room/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";
import type { components } from "@/types/api";
import type { Account } from "@/types/db";

type MyAccountResponse = components["schemas"]["MyAccountResponse"];

/**
 * 로그인된 내 계정 — 헤더 프로필 드롭다운, 계정 페이지 등이 부른다.
 *
 * 목 로그인 후에는 선택한 데모 계정을 사용한다. 기존 로컬 화면은 기본 계정으로 열린다.
 *
 * ⚠️ BE 명세는 `GET /api/v1/accounts/me` 이고 Bearer 토큰이 있어야 `@LoginAccount` 가
 *    accountId 를 뽑는다. 토큰을 넘기지 않으면 401 로 떨어져 사용자 정보에 의존하는 모든
 *    화면이 전역으로 깨진다.
 */
export const getMyAccount = cache(async (): Promise<Account> => {
  await requireAuthSession();
  if (isMock) {
    const me = (await getExplicitMockAccount()) ?? accounts[0];
    if (!me) throw new Error("mock accounts[0] 가 비어 있다 — 시드를 확인하세요.");
    return me;
  }
  const accessToken = await readAccessToken();
  const res = await api<MyAccountResponse>("/api/v1/accounts/me", { accessToken, cache: "no-store" });
  return toAccount(res);
});

export async function getExplicitMockAccount() {
  if (!isMock) return null;
  const id = Number((await cookies()).get(MOCK_ACCOUNT_COOKIE)?.value);
  if (!Object.values(MOCK_ACCOUNT_IDS).some((accountId) => accountId === id)) return null;
  return accounts.find((account) => account.id === id) ?? null;
}

export async function getWithdrawalCheck() {
  if (isMock) {
    const ownedRooms = (await listMyRoomsForSettings()).filter(({ isOwner }) => isOwner)
      .map(({ id, name, memberCount }) => ({ roomId: id, name, memberCount }));
    return { withdrawable: ownedRooms.length === 0, ownedRooms, canWithdraw: false };
  }
  await requireAuthSession();
  const result = await api<components["schemas"]["WithdrawalCheckResponse"]>(
    "/api/v1/accounts/me/withdrawal-check", { cache: "no-store" },
  );
  return { withdrawable: result.withdrawable === true, ownedRooms: result.ownedRooms ?? [], canWithdraw: true };
}

export async function getLoginDestination(accessToken: string) {
  if (isMock || isAuthMock) return "/workspaces";
  const result = await api<MyAccountResponse>("/api/v1/accounts/me", { cache: "no-store", accessToken });
  return Number.isSafeInteger(result.lastRoomId) && Number(result.lastRoomId) > 0
    ? `/rooms/${result.lastRoomId}`
    : "/workspaces";
}

async function readAccessToken(): Promise<string | undefined> {
  const name = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
  return (await cookies()).get(name)?.value;
}

/**
 * BE `MyAccountResponse`(accountId) → FE `Account`(id) 매핑.
 *
 * ⚠️ OpenAPI 로 생성된 타입은 전 필드가 optional 이지만, BE 는 로그인 사용자에게 모두 돌려준다.
 *    누락이 발견되면 BE 담당자에게 공유 — 이 함수가 런타임 가드 역할도 겸한다.
 */
function toAccount(res: MyAccountResponse): Account {
  // ⚠️ email 은 스키마가 빈 문자열을 허용하므로 `!res.email` 대신 nullish 검사를 쓴다.
  //    빈 문자열까지 누락으로 잡으면 BE 가 (드물게) 빈 이메일을 돌려줄 때 전역 가드가 터진다.
  if (
    res.accountId == null ||
    !res.provider ||
    !res.name ||
    res.email == null ||
    !res.role ||
    !res.toneMode ||
    !res.createdAt
  ) {
    throw new Error("GET /api/v1/accounts/me 응답에 필수 필드가 비어 있습니다.");
  }
  return {
    id: res.accountId,
    provider: res.provider,
    name: res.name,
    email: res.email,
    role: res.role,
    toneMode: res.toneMode,
    lastRoomId: res.lastRoomId ?? null,
    createdAt: res.createdAt,
  };
}
