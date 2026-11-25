import "server-only";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { PageResponse } from "@/types/db";

import type {
  NotionDatabase,
  NotionExport,
  NotionIntegration,
} from "./types";

const EMPTY_INTEGRATION: NotionIntegration = {
  connected: false,
  workspaceName: null,
  targetDatabase: null,
  exportMode: "MANUAL",
  enabled: true,
  tokenExpired: false,
};

/**
 * 방의 노션 연동 상태 — 명세 `GET /api/v1/rooms/{roomId}/integrations/notion`.
 *
 * ⚠️ 목 모드는 "아직 연결 안 함" 기본값. 설정 화면이 "노션 연결" 버튼만 있는 상태로 열린다.
 * ⚠️ BE 가 연동 레코드 없을 때 404 로 응답할 수도 있어 안전망으로 수렴.
 */
export async function getNotionIntegration(roomId: number): Promise<NotionIntegration> {
  if (isMock) return EMPTY_INTEGRATION;
  try {
    const res = await api<NotionIntegration>(
      `/api/v1/rooms/${roomId}/integrations/notion`,
      { cache: "no-store" },
    );
    return {
      connected: res.connected ?? false,
      workspaceName: res.workspaceName ?? null,
      targetDatabase: res.targetDatabase ?? null,
      exportMode: res.exportMode ?? "MANUAL",
      enabled: res.enabled ?? true,
      tokenExpired: res.tokenExpired ?? false,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return EMPTY_INTEGRATION;
    throw e;
  }
}

/**
 * 연결된 노션 워크스페이스의 DB 목록 — 명세 `GET /api/v1/rooms/{roomId}/integrations/notion/databases`.
 * OAuth 미완료 상태에서 호출하면 BE 가 거절하므로 UI 는 `connected=true` 일 때만 쿼리.
 */
export async function listNotionDatabases(roomId: number): Promise<NotionDatabase[]> {
  if (isMock) return [];
  try {
    return await api<NotionDatabase[]>(
      `/api/v1/rooms/${roomId}/integrations/notion/databases`,
      { cache: "no-store" },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}

/**
 * 노션 내보내기 이력 — 명세 `GET /api/v1/rooms/{roomId}/integrations/notion/exports`.
 * 최신 exportedAt 역순. page/size 는 BE default 0/20.
 */
export async function listNotionExports(
  roomId: number,
  params: { page?: number; size?: number } = {},
): Promise<PageResponse<NotionExport>> {
  const empty: PageResponse<NotionExport> = {
    content: [],
    page: 0,
    size: params.size ?? 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  };
  if (isMock) return empty;

  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.size != null) qs.set("size", String(params.size));
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    return await api<PageResponse<NotionExport>>(
      `/api/v1/rooms/${roomId}/integrations/notion/exports${suffix}`,
      { cache: "no-store" },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return empty;
    throw e;
  }
}
