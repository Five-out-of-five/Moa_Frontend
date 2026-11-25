/**
 * 채팅 도메인 FE 임시 타입 — BE 채널/DM 스펙이 확정되면 `src/types/db.ts` 로 승격한다.
 */

/** BE `ChannelType` 과 1:1. PUBLIC·PRIVATE 은 사이드바 채널로, DIRECT 는 DM 스레드로 분기. */
export type ChannelType = "PUBLIC" | "PRIVATE" | "DIRECT";

/** BE `ChannelMemberStatus` — 초대·참여·나감·내보내짐. */
export type ChannelMemberStatus = "INVITED" | "JOINED" | "LEFT" | "KICKED";

/** 기존 UI 호환용 좁은 kind. `channelType` 가 DIRECT 인 채널은 사이드바에 등장하지 않는다. */
export type ChatChannelKind = "PUBLIC" | "PRIVATE";

export interface ChatChannel {
  id: number;
  roomId: number;
  kind: ChatChannelKind;
  /** BE `channelType` 원본. 분기 로직이 DIRECT 를 함께 쓰려면 이걸 본다. */
  channelType: ChannelType;
  name: string;
  /** 채널 설명 — 헤더 상단에 보조 라벨로 노출. */
  topic?: string;
  /** 활성 참여자 수 — 헤더 우측 멤버 뱃지에 쓴다. */
  memberCount?: number;
  unreadCount: number;
  /** 방 기본 채널 여부 (삭제 불가 뱃지·안내). BE `isDefault`. */
  isDefault?: boolean;
  /** 생성자 accountId — 삭제·수정 권한 판정에 쓴다. */
  creatorAccountId?: number;
  /** 내 참여 상태 — INVITED 면 수락 버튼 노출 등. BE `myStatus` 가 enum 문자열로 떨어짐. */
  myStatus?: ChannelMemberStatus;
}

/** 채널 참여자 — 멤버 조회/추가/내보내기 UI 공통. BE `ChannelMemberResponse` 그대로. */
export interface ChatChannelMember {
  accountId: number;
  displayName: string;
  profileImageUrl: string | null;
  status: ChannelMemberStatus;
  online: boolean;
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

/**
 * 채팅 메시지 — 채널/DM 공통 shape.
 *
 * ⚠️ `pending` 은 전송 낙관적 추가용 — WS 가 붙기 전엔 로컬 state 로만 토글. 서버 왕복이
 *    시작되면 `kind: "sent" | "pending" | "failed"` 로 확장 가능.
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
}
