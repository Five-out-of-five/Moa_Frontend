import { accounts, rooms } from "@/mocks/db";

import type { ChatChannel, DirectMessageThread } from "./types";

/**
 * 채팅 목 시드. 방별로 공개·비공개 채널을 깔아 두고, 로그인 유저(홍근 계정) 의
 * 1:1 메시지 스레드 몇 개를 시드로 둔다. BE 채널 명세가 붙기 전까지 UI 확인용.
 */

const coreRoomId = rooms[0]?.id ?? 1;
const kdtRoomId = rooms[1]?.id ?? 2;

export const CHAT_CHANNELS: ChatChannel[] = [
  // MOA 코어팀
  { id: 101, roomId: coreRoomId, kind: "PUBLIC", name: "일반", unreadCount: 0 },
  { id: 102, roomId: coreRoomId, kind: "PUBLIC", name: "제품-논의", unreadCount: 1 },
  { id: 103, roomId: coreRoomId, kind: "PUBLIC", name: "자유-대화", unreadCount: 0 },
  { id: 104, roomId: coreRoomId, kind: "PRIVATE", name: "출시-준비", unreadCount: 0 },
  { id: 105, roomId: coreRoomId, kind: "PRIVATE", name: "리더-회의", unreadCount: 0 },
  // 26KDT 1팀
  { id: 201, roomId: kdtRoomId, kind: "PUBLIC", name: "일반", unreadCount: 0 },
  { id: 202, roomId: kdtRoomId, kind: "PUBLIC", name: "회고", unreadCount: 2 },
];

// accounts[0] 가 로그인 유저. 그 외 계정과의 DM 스레드
const [me, ...others] = accounts;

export const DM_THREADS: DirectMessageThread[] = me
  ? others.slice(0, 3).map((acc, i) => ({
      id: 300 + i,
      accountId: acc.id,
      displayName: acc.name,
      online: i < 2,
      unreadCount: 0,
    }))
  : [];
