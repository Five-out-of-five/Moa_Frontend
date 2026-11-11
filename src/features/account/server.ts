import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";
import type { Account } from "@/types/db";

/**
 * 로그인된 내 계정 — 헤더 프로필 드롭다운, 계정 페이지 등이 부른다.
 *
 * ⚠️ 목 모드에선 홍근 계정(id=1) 하나만 "로그인된 사용자" 로 취급한다. BE 가 붙으면
 *    httpOnly 세션 쿠키에서 accountId 를 뽑는다 — 알림 server.ts 와 동일한 전환 지점.
 */
export async function getMyAccount(): Promise<Account> {
  if (isMock) {
    const me = accounts.find((a) => a.id === 1);
    if (!me) throw new Error("mock accounts[0] 가 비어 있다 — 시드를 확인하세요.");
    return me;
  }
  return api<Account>("/api/v1/me");
}
