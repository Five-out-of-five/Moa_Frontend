/**
 * 슬랙 연동 FE 타입 — BE `integration/slack` 도메인 그대로.
 */

/** BE `SlackEventType`. 네 가지 이벤트가 슬랙으로 흘러갈 수 있다. */
export type SlackEventType =
  | "VOTE_CREATED"
  | "VOTE_CLOSED"
  | "TASK_DUE_SOON"
  | "SESSION_SUMMARY";

/** BE `SlackDeliveryStatus`. */
export type SlackDeliveryStatus = "SUCCESS" | "FAILED";

/**
 * 슬랙 연동 상태 — BE `SlackIntegrationResponse`.
 *
 * ⚠️ `webhookUrlMasked` 는 서버가 가린 값(앞 뒤 일부). FE 는 **수정 시 null 로 보내면 유지**,
 *    값으로 보내면 교체. 실제 원문 webhookUrl 은 FE 가 받지 못한다.
 * ⚠️ `enabled` 가 false 면 BE 가 자동 비활성화한 상태 (consecutiveFailCount 초과). UI 는
 *    "n 회 연속 실패로 비활성화됨, YYYY-MM-DD HH:mm" 안내를 노출.
 */
export interface SlackIntegration {
  connected: boolean;
  webhookUrlMasked: string | null;
  eventTypes: SlackEventType[];
  enabled: boolean;
  consecutiveFailCount: number;
  disabledAt: string | null;
}

/** BE `SlackDeliveryResponse` — 발송 이력 한 건. */
export interface SlackDelivery {
  eventType: SlackEventType;
  status: SlackDeliveryStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
}
