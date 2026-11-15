/**
 * 채팅 도메인 FE 임시 타입 — BE 채널/DM 스펙이 확정되면 `src/types/db.ts` 로 승격한다.
 */

export type ChatChannelKind = "PUBLIC" | "PRIVATE";

export interface ChatChannel {
  id: number;
  roomId: number;
  kind: ChatChannelKind;
  name: string;
  unreadCount: number;
}

export interface DirectMessageThread {
  id: number;
  /** 상대 accountId */
  accountId: number;
  /** 상대 이름 */
  displayName: string;
  online: boolean;
  unreadCount: number;
}
