/**
 * 노션 연동 FE 타입 — BE `integration/notion` 도메인 그대로.
 */

/** BE `NotionExportMode` — 수동 or 회차 종료 시 자동. */
export type NotionExportMode = "MANUAL" | "ON_SESSION_CLOSE";

/** BE `NotionExportStatus` — 내보내기 결과. */
export type NotionExportStatus = "SUCCESS" | "FAILED";

/**
 * 노션 연동 상태 — BE `NotionIntegrationResponse`.
 *
 * ⚠️ `connected=false` 는 OAuth 전 상태. `tokenExpired=true` 는 OAuth 는 했었지만 토큰 만료.
 *    두 경우 모두 "노션 연결" 버튼을 띄우고 재인증을 유도한다.
 * ⚠️ `targetDatabase` 가 null 이면 **DB 선택 전** 상태. 내보내기 전에 DB 를 반드시 지정해야 함.
 */
export interface NotionIntegration {
  connected: boolean;
  workspaceName: string | null;
  targetDatabase: NotionDatabaseRef | null;
  exportMode: NotionExportMode;
  enabled: boolean;
  tokenExpired: boolean;
}

export interface NotionDatabaseRef {
  id: string;
  title: string;
}

/** 노션 DB 목록 — BE `NotionDatabaseResponse`. */
export interface NotionDatabase {
  id: string;
  title: string;
}

/** 내보내기 이력 한 건 — BE `NotionExportResponse`. */
export interface NotionExport {
  sessionId: number;
  notionPageId: string | null;
  status: NotionExportStatus;
  exportedAt: string;
}
