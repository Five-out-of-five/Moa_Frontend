/**
 * 채팅 도메인 FE 임시 타입 — BE 채널/DM 스펙이 확정되면 `src/types/db.ts` 로 승격한다.
 */

export type ChatChannelKind = "PUBLIC" | "PRIVATE";

export interface ChatChannel {
  id: number;
  roomId: number;
  kind: ChatChannelKind;
  name: string;
  /** 채널 설명 — 헤더 상단에 보조 라벨로 노출. */
  topic?: string;
  /** 활성 참여자 수 — 헤더 우측 멤버 뱃지에 쓴다. */
  memberCount?: number;
  unreadCount: number;
}

export interface DirectMessageThread {
  id: number;
  roomId?: number;
  /** 상대 accountId */
  accountId: number;
  /** 상대 이름 */
  displayName: string;
  online: boolean;
  unreadCount: number;
}

/** 메시지 작성자 — 채널/DM 공통. BE 가 붙으면 `MemberRef` 로 승격 가능. */
export interface ChatMessageAuthor {
  accountId: number;
  displayName: string;
  /** 접속 상태 — DM 쪽에서만 의미가 있고 채널 메시지 리스트에선 쓰지 않는다. */
  online?: boolean;
}

/** BE `MessageType` — 일반·파일·시스템 알림. */
export type MessageType = "TEXT" | "FILE" | "SYSTEM";

/**
 * 채팅 메시지 — 채널/DM 공통 shape.
 *
 * ⚠️ `pending` 은 전송 낙관적 추가용 — WS 가 붙기 전엔 로컬 state 로만 토글. 서버 왕복이
 *    시작되면 `kind: "sent" | "pending" | "failed"` 로 확장 가능.
 * ⚠️ `clientMessageId` 는 전송 요청 때 FE 가 발급(crypto.randomUUID)한 idempotency 키.
 *    서버가 그대로 echo 해 주므로 낙관적 추가한 로컬 메시지를 서버 응답과 매칭할 때 쓴다.
 * ⚠️ `edited` 는 서버가 수정 여부를 돌려준 플래그. UI 는 "(수정됨)" 라벨.
 */
export interface ChatMessage {
  id: number;
  author: ChatMessageAuthor;
  /** ISO-8601, 서버 시각 기준. */
  createdAt: string;
  content: string;
  pending?: boolean;
  deleted?: boolean;
  isSystem?: boolean;
  edited?: boolean;
  clientMessageId?: string;
  messageType?: MessageType;
}
