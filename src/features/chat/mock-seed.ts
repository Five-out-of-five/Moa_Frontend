import { accounts, rooms } from "@/mocks/db";

import type {
  ChatChannel,
  ChatMessage,
  DirectMessageThread,
} from "./types";

/**
 * 채팅 목 시드. 방별로 공개·비공개 채널을 깔아 두고, 로그인 유저(홍근 계정) 의
 * 1:1 메시지 스레드 몇 개를 시드로 둔다. BE 채널 명세가 붙기 전까지 UI 확인용.
 */

const coreRoomId = rooms[0]?.id ?? 1;
const kdtRoomId = rooms[1]?.id ?? 2;

export const CHAT_CHANNELS: ChatChannel[] = [
  // MOA 코어팀
  {
    id: 101,
    roomId: coreRoomId,
    kind: "PUBLIC",
    name: "일반",
    topic: "팀 전체 공지와 가벼운 대화",
    memberCount: 5,
    unreadCount: 0,
  },
  {
    id: 102,
    roomId: coreRoomId,
    kind: "PUBLIC",
    name: "제품-논의",
    topic: "제품 방향과 기능 토론",
    memberCount: 5,
    unreadCount: 1,
  },
  {
    id: 103,
    roomId: coreRoomId,
    kind: "PUBLIC",
    name: "자유-대화",
    topic: "주제 가리지 않는 잡담",
    memberCount: 5,
    unreadCount: 0,
  },
  {
    id: 104,
    roomId: coreRoomId,
    kind: "PRIVATE",
    name: "출시-준비",
    topic: "릴리즈 전 체크와 공유",
    memberCount: 3,
    unreadCount: 0,
  },
  {
    id: 105,
    roomId: coreRoomId,
    kind: "PRIVATE",
    name: "리더-회의",
    topic: "리더 그룹 전용",
    memberCount: 2,
    unreadCount: 0,
  },
  // 26KDT 1팀
  {
    id: 201,
    roomId: kdtRoomId,
    kind: "PUBLIC",
    name: "일반",
    topic: "KDT 1팀 공지",
    memberCount: 3,
    unreadCount: 0,
  },
  {
    id: 202,
    roomId: kdtRoomId,
    kind: "PUBLIC",
    name: "회고",
    topic: "주간 회고와 액션 아이템",
    memberCount: 3,
    unreadCount: 2,
  },
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

/**
 * 채팅 메시지 목 시드. 채널별로 "어제~오늘" 시간대에 걸친 4~6개 메시지를 넣어 **날짜 구분선·
 * 작성자 그룹화·Hero 섹션** 세 가지 상태를 한 번에 확인할 수 있게 한다.
 *
 * ⚠️ 시간은 생성 시점 기준 상대값 (ms 단위 offset) — 리로드 할 때마다 "오늘" 이 갱신돼
 *    날짜 구분선이 자연스럽게 흐른다. 고정 ISO 를 박아두면 몇 주 뒤에는 모두 "지난 주" 가
 *    돼 Hero 와 구분선 스타일을 테스트하기 어려워진다.
 * ⚠️ DM 쪽은 상대방과의 왕복만 보이면 UI 가 충분히 그려지므로 짧게 둔다.
 */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 상대 시점(ms offset) 을 ISO 로 변환. 현재 시각 기준 `offsetMs` 만큼 과거. */
const ago = (offsetMs: number): string =>
  new Date(Date.now() - offsetMs).toISOString();

function pickAuthor(index: number): { accountId: number; displayName: string } {
  const list = accounts.length > 0 ? accounts : [];
  const acc = list[index % Math.max(1, list.length)];
  return acc
    ? { accountId: acc.id, displayName: acc.name }
    : { accountId: 0, displayName: "알 수 없음" };
}

export const CHANNEL_MESSAGES: Record<number, ChatMessage[]> = {
  // 101 "일반" — Hero 섹션 확인용 빈 채널
  101: [],
  // 102 "제품-논의" — 어제/오늘 섞인 샘플
  102: [
    {
      id: 10201,
      author: pickAuthor(4),
      createdAt: ago(DAY + 2 * HOUR),
      content:
        "지난 주 사용자 피드백 기준으로 온보딩 개선안을 세 가지로 정리했습니다.",
    },
    {
      id: 10202,
      author: pickAuthor(3),
      createdAt: ago(DAY + 1 * HOUR + 50 * MIN),
      content:
        "첫 화면에서 산책지도 줄이는 안으로 시안 만들어 볼게요.",
    },
    {
      id: 10203,
      author: pickAuthor(3),
      createdAt: ago(5 * HOUR),
      content:
        "오늘 팀 시안에 새 아이콘 반영했어요. 시간 될 때 확인 부탁드립니다.",
    },
    {
      id: 10204,
      author: pickAuthor(1),
      createdAt: ago(3 * HOUR + 10 * MIN),
      content: "좋네요, 바로 볼게요!",
    },
    {
      id: 10205,
      author: pickAuthor(1),
      createdAt: ago(3 * HOUR + 9 * MIN),
      content:
        "아이콘 세트는 Lucide + Simple Icons 조합 기준으로 가면 될 것 같아요.",
    },
  ],
  // 103 "자유-대화"
  103: [
    {
      id: 10301,
      author: pickAuthor(2),
      createdAt: ago(2 * DAY + 4 * HOUR),
      content: "점심 뭐 드실 분?",
    },
    {
      id: 10302,
      author: pickAuthor(4),
      createdAt: ago(2 * DAY + 3 * HOUR + 50 * MIN),
      content: "저는 오늘 집에서 챙겨왔어요 🍱",
    },
    {
      id: 10303,
      author: pickAuthor(1),
      createdAt: ago(45 * MIN),
      content: "이따 티타임 때 커피 주문 받을게요 ☕",
    },
  ],
  // 104 "출시-준비"
  104: [
    {
      id: 10401,
      author: pickAuthor(1),
      createdAt: ago(1 * DAY + 2 * HOUR),
      content:
        "릴리즈 노트 초안 공유드립니다. 수정 의견 내일 오전까지 모아 주세요.",
    },
    {
      id: 10402,
      author: pickAuthor(4),
      createdAt: ago(20 * HOUR),
      content: "도메인 설정 끝났습니다. 스테이징 반영 확인 부탁드려요.",
    },
  ],
  // 105 "리더-회의"
  105: [
    {
      id: 10501,
      author: pickAuthor(0),
      createdAt: ago(6 * HOUR),
      content: "다음 주 리뷰 포인트 정리해서 올려 둘게요.",
    },
  ],
  // 201 "일반" (KDT)
  201: [
    {
      id: 20101,
      author: pickAuthor(2),
      createdAt: ago(1 * DAY + 5 * HOUR),
      content: "이번 주 회고 주제 미리 올려 둬도 될까요?",
    },
  ],
  // 202 "회고" (KDT)
  202: [
    {
      id: 20201,
      author: pickAuthor(0),
      createdAt: ago(1 * DAY + 10 * HOUR),
      content: "지난 스프린트 Keep/Problem/Try 각자 한 줄씩 남겨 주세요.",
    },
    {
      id: 20202,
      author: pickAuthor(3),
      createdAt: ago(1 * DAY + 9 * HOUR),
      content:
        "Keep: PR 리뷰 터닝 빨라짐 / Problem: 명세 변경 공유 지연 / Try: 매일 스탠드업",
    },
  ],
};

/**
 * DM 메시지 목 시드 — thread id 별로 메시지 배열. 로그인 유저(accounts[0]) 와 상대방이
 * 번갈아 몇 줄 주고받는 형태.
 */
export const DM_MESSAGES: Record<number, ChatMessage[]> = {
  300: [
    {
      id: 30001,
      author: pickAuthor(1),
      createdAt: ago(1 * DAY + 3 * HOUR),
      content: "회의록 보냈습니다. 확인 부탁드려요!",
    },
    {
      id: 30002,
      author: pickAuthor(0),
      createdAt: ago(1 * DAY + 2 * HOUR + 40 * MIN),
      content: "방금 확인했어요. 수정사항 몇 개만 코멘트 남길게요.",
    },
    {
      id: 30003,
      author: pickAuthor(1),
      createdAt: ago(30 * MIN),
      content: "감사합니다 🙏",
    },
  ],
  301: [
    {
      id: 30101,
      author: pickAuthor(2),
      createdAt: ago(4 * HOUR),
      content: "디자인 리뷰 1시로 옮겨도 괜찮을까요?",
    },
    {
      id: 30102,
      author: pickAuthor(0),
      createdAt: ago(3 * HOUR + 55 * MIN),
      content: "네 좋습니다!",
    },
  ],
  302: [],
};
