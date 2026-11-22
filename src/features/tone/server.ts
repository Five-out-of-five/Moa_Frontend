import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { api } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";
import type { ToneMode } from "@/types/db";

export const getToneMode = cache(async (): Promise<ToneMode> => {
  if (isMock) return (await getMyAccount()).toneMode;
  const { init } = await getApiAccountContext();
  const account = await api<components["schemas"]["MyAccountResponse"]>(
    "/api/v1/accounts/me",
    init,
  );
  if (!account.toneMode) throw new Error("순화 설정을 불러오지 못했어요.");
  return account.toneMode;
});
