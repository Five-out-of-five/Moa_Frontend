import "server-only";

import { unstable_rethrow } from "next/navigation";

import { ApiError } from "@/lib/api";

export function aiFailure(error: unknown, fallback: string) {
  unstable_rethrow(error);
  if (error instanceof ApiError) return { ok: false as const, error: error.message, code: error.code };
  return { ok: false as const, error: error instanceof Error ? error.message : fallback };
}
