import "server-only";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { PageResponse } from "@/types/db";

import type {
  SlackDelivery,
  SlackDeliveryStatus,
  SlackEventType,
  SlackIntegration,
} from "./types";

/**
 * 방의 슬랙 연동 상태 — 명세 `GET /api/v1/rooms/{roomId}/integrations/slack`.
 *
 * ⚠️ 목 모드는 "아직 연결 안 함" 기본값. 설정 화면이 비어 있는 상태로 열리고 "웹훅 URL 추가"
 *    버튼이 1차 action.
 * ⚠️ 실 API 에서 BE 가 아직 연동 레코드가 없을 때 무엇을 돌려주는지 (null vs 기본값 응답) 는
 *    service 구현에 따라 다르다. 404 가 떨어지는 경우를 위해 안전망으로 null → 기본값 수렴.
 */
export async function getSlackIntegration(roomId: number): Promise<SlackIntegration> {
  if (isMock) {
    return {
      connected: false,
      webhookUrlMasked: null,
      eventTypes: [],
      enabled: true,
      consecutiveFailCount: 0,
      disabledAt: null,
    };
  }
  try {
    const res = await api<SlackIntegration>(
      `/api/v1/rooms/${roomId}/integrations/slack`,
      { cache: "no-store" },
    );
    // BE 가 nullable 필드를 생략해 보낼 수 있어 FE 쓰임새에 맞게 기본값으로 정규화.
    return {
      connected: res.connected ?? false,
      webhookUrlMasked: res.webhookUrlMasked ?? null,
      eventTypes: res.eventTypes ?? [],
      enabled: res.enabled ?? true,
      consecutiveFailCount: res.consecutiveFailCount ?? 0,
      disabledAt: res.disabledAt ?? null,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return {
        connected: false,
        webhookUrlMasked: null,
        eventTypes: [],
        enabled: true,
        consecutiveFailCount: 0,
        disabledAt: null,
      };
    }
    throw e;
  }
}

/**
 * 슬랙 발송 이력 — 명세 `GET /api/v1/rooms/{roomId}/integrations/slack/deliveries`.
 * 필터: status (SUCCESS·FAILED) · page · size (기본 20). 최신순.
 */
export async function listSlackDeliveries(
  roomId: number,
  params: { status?: SlackDeliveryStatus; page?: number; size?: number } = {},
): Promise<PageResponse<SlackDelivery>> {
  const empty: PageResponse<SlackDelivery> = {
    content: [],
    page: 0,
    size: params.size ?? 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  };
  if (isMock) return empty;

  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.size != null) qs.set("size", String(params.size));
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    return await api<PageResponse<SlackDelivery>>(
      `/api/v1/rooms/${roomId}/integrations/slack/deliveries${suffix}`,
      { cache: "no-store" },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return empty;
    throw e;
  }
}

export type { SlackEventType };
