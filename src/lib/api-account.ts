import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { components } from "@/types/api";

import { api } from "./api";

export const getApiAccountContext = cache(async () => {
  const accessToken = (await cookies()).get(
    process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken",
  )?.value;
  const init = { accessToken, cache: "no-store" as const };
  const { accountId } = await api<components["schemas"]["MyAccountResponse"]>(
    "/api/v1/accounts/me",
    init,
  );
  if (!accountId) throw new Error("계정 정보를 확인할 수 없어요.");
  return { init, query: `accountId=${accountId}`, accountId };
});
