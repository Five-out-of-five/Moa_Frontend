import "server-only";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { api, ApiError, type ApiInit } from "@/lib/api";

import type { DashboardSnapshot } from "./live-types";
import { getDashboardSnapshot } from "./server";
import { toDashboardSnapshot } from "./snapshot";

export type LayoutResult =
  | { ok: true; snapshot: DashboardSnapshot }
  | { ok: false; message: string; code?: string; snapshot?: DashboardSnapshot };

const REFRESH_CODES = new Set([
  "DASHBOARD_WIDGET_ALREADY_EXISTS",
  "DASHBOARD_WIDGET_OVERLAP",
  "DASHBOARD_WIDGET_NOT_FOUND",
  "DASHBOARD_LAST_WIDGET",
]);

export function revalidateDashboard(roomId: number, shouldRefreshMediation = false) {
  revalidatePath(`/rooms/${roomId}`);
  if (shouldRefreshMediation) {
    revalidatePath(`/rooms/${roomId}/mediation`);
    revalidatePath(`/rooms/${roomId}/boards/idea`);
  }
}

type LayoutChange = { path: string; init: ApiInit; shouldRefreshMediation?: boolean };

export async function changeApiLayout(
  roomId: number,
  change: () => LayoutChange | Promise<LayoutChange>,
): Promise<LayoutResult> {
  try {
    const { path, init, shouldRefreshMediation } = await change();
    const response = await api<unknown>(`/api/v1/rooms/${roomId}/dashboard/${path}`, {
      ...init,
      cache: "no-store",
    });
    const snapshot = toDashboardSnapshot(roomId, response);
    revalidateDashboard(roomId, shouldRefreshMediation);
    return { ok: true, snapshot };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof ApiError))
      return { ok: false, message: "레이아웃을 저장하지 못했습니다. 다시 시도해 주세요." };
    if (error.code === "ROOM_INACTIVE") redirect("/workspaces?roomStatus=inactive");
    if (error.code === "ROOM_NOT_FOUND" || error.code === "ROOM_NOT_MEMBER")
      redirect("/workspaces");
    const snapshot = REFRESH_CODES.has(error.code)
      ? await getDashboardSnapshot(roomId).catch((refreshError: unknown) => {
          unstable_rethrow(refreshError);
          return undefined;
        })
      : undefined;
    return { ok: false, code: error.code, message: error.message, snapshot };
  }
}
