import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import type { ToneMode } from "@/types/db";

export const getToneMode = cache(async (): Promise<ToneMode> => {
  return (await getMyAccount()).toneMode;
});
