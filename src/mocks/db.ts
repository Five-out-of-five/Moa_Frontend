import { faker } from "@faker-js/faker";

import type {
  Account,
  BoardEvent,
  BoardSession,
  CardConflict,
  CompromiseDraft,
  IdeaCard,
  IdeaCardType,
  MemberRef,
  MoodLevel,
  MoodStatus,
  Notification,
  Room,
  RoomMember,
  RoomWidget,
  Sprint,
  Task,
  TaskStatus,
  VoteDetail,
  WidgetType,
} from "@/types/db";

/**
 * 인메모리 목 저장소 — Next 서버 한 프로세스 내에서 공유되는 가변 상태다.
 *
 * ⚠️ 목 모드(`isMock = true`) 에서만 접근해야 한다.
 * ⚠️ 서버 재시작하면 리셋된다. 이게 싫은 데이터는 아직 없다 (개발 중).
 *
 * 시드는 결정적(seed 고정) 으로 깔아 두어 BE 가 붙기 전까지 **동일한 상태** 로 개발한다.
 */

faker.seed(2026_11_05);

// ===== 공통 ID 발급기 =====

const seq = (() => {
  const counters = new Map<string, number>();
  return (ns: string): number => {
    const n = (counters.get(ns) ?? 0) + 1;
    counters.set(ns, n);
    return n;
  };
})();

const nowIso = () => new Date().toISOString();
const todayDate = () => new Date().toISOString().slice(0, 10);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 회원 =====

const PROVIDERS = ["GOOGLE", "KAKAO", "NAVER"] as const;

function makeAccount(name: string, email: string): Account {
  return {
    id: seq("account"),
    provider: pick(PROVIDERS),
    name,
    email,
    role: "USER",
    toneMode: "POLISH",
    lastRoomId: null,
    createdAt: nowIso(),
  };
}

export const accounts: Account[] = [
  makeAccount("이홍근", "zana0422@gmail.com"),
  makeAccount("이주은", "jueun@example.com"),
  makeAccount("이하연", "hayeon@example.com"),
  makeAccount("백승재", "seungjae@example.com"),
  makeAccount("김진도", "jindo@example.com"),
];

function refOf(acc: Account): MemberRef {
  return {
    accountId: acc.id,
    displayName: acc.name,
    profileImageUrl: null,
    memberStatus: "ACTIVE",
  };
}

// ===== 방 + 방 멤버 =====

export const rooms: Room[] = [
  {
    id: seq("room"),
    name: "MOA 코어팀",
    description: "MOA 프로덕트 자체 운영 방",
    imageUrl: null,
    memberCount: accounts.length,
    maxMemberCount: 20,
    createdAt: nowIso(),
  },
  {
    id: seq("room"),
    name: "26KDT 1팀",
    description: "컨설팅 프로젝트 협업 방",
    imageUrl: null,
    memberCount: 3,
    maxMemberCount: 20,
    createdAt: nowIso(),
  },
];

export const roomMembers: RoomMember[] = rooms.flatMap((room, i) =>
  accounts.slice(0, i === 0 ? accounts.length : 3).map((acc, idx) => ({
    id: seq("roomMember"),
    roomId: room.id,
    accountId: acc.id,
    nickname: null,
    role: idx === 0 ? ("OWNER" as const) : ("MEMBER" as const),
    state: "ACTIVE" as const,
    notificationMuted: false,
    lastBriefingCheckedAt: null,
    joinedAt: nowIso(),
  })),
);

// ===== 위젯 배치 (방당 7종) =====

const WIDGET_TYPES: WidgetType[] = [
  "MOOD",
  "IDEA_BOARD",
  "TASK_BOARD",
  "PROGRESS",
  "VOTE",
  "CATCHUP_BRIEFING",
  "MEDIATION",
];

// 기본 배치 (테이블정의서 room_widget §비고): 상태값 (0,0,3,4), 아이디어 (3,0,6,7),
// 캐치업 (9,0,3,7), 업무 (3,7,6,4). 나머지는 빈 공간에 임의 배치.
export const roomWidgets: RoomWidget[] = rooms.flatMap((room) =>
  WIDGET_TYPES.map((t) => {
    const preset: Record<WidgetType, [number, number, number, number]> = {
      MOOD: [0, 0, 3, 4],
      IDEA_BOARD: [3, 0, 6, 7],
      TASK_BOARD: [3, 7, 6, 4],
      PROGRESS: [0, 4, 3, 3],
      VOTE: [0, 7, 3, 4],
      CATCHUP_BRIEFING: [9, 0, 3, 7],
      MEDIATION: [9, 7, 3, 4],
    };
    const [x, y, w, h] = preset[t];
    return {
      id: seq("roomWidget"),
      roomId: room.id,
      widgetType: t,
      x,
      y,
      width: w,
      height: h,
    } satisfies RoomWidget;
  }),
);

// ===== 상태값 (MOOD) =====

const MOODS: MoodLevel[] = ["GREAT", "GOOD", "SOSO", "TIRED", "BAD"];

export const moodStatuses: MoodStatus[] = rooms.flatMap((room) =>
  roomMembers
    .filter((m) => m.roomId === room.id)
    .map((m) => ({
      id: seq("mood"),
      roomId: room.id,
      accountId: m.accountId,
      mood: pick(MOODS),
      note: pick([
        null,
        "스프린트 시작 날이라 설레요",
        "오늘 회의 많아서 지친다",
        "휴식 많이 취해서 컨디션 좋음",
      ] as const),
      recordedDate: todayDate(),
    })),
);

// ===== 아이디어 보드 (IDEA_BOARD) =====

export const boardSessions: BoardSession[] = rooms.map((room) => ({
  id: seq("session"),
  roomId: room.id,
  title: "이번 주 회고",
  state: "ACTIVE",
  startsAt: nowIso(),
  endsAt: null,
}));

const CARD_TYPES: IdeaCardType[] = ["AGENDA", "KEEP", "PROBLEM", "TRY"];

export const ideaCards: IdeaCard[] = boardSessions.flatMap((session) =>
  CARD_TYPES.flatMap((type) =>
    Array.from({ length: 2 }, (_, i) => {
      const author = pick(accounts);
      return {
        id: seq("ideaCard"),
        roomId: session.roomId,
        sessionId: session.id,
        cardType: type,
        title: faker.lorem.sentence({ min: 3, max: 7 }),
        content: faker.lorem.paragraph({ min: 1, max: 3 }),
        author: refOf(author),
        sortOrder: i,
        commentCount: faker.number.int({ min: 0, max: 4 }),
        reactionCount: faker.number.int({ min: 0, max: 8 }),
        convertedTaskId: null,
        createdAt: nowIso(),
      } satisfies IdeaCard;
    }),
  ),
);

// ===== 업무 보드 (TASK_BOARD) + 스프린트 (PROGRESS) =====

export const sprints: Sprint[] = rooms.map((room) => ({
  id: seq("sprint"),
  roomId: room.id,
  name: "11월 1주차",
  state: "ACTIVE",
  startsAt: nowIso(),
  endsAt: null,
  totalTasks: 0,
  doneTasks: 0,
}));

const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export const tasks: Task[] = sprints.flatMap((sprint) => {
  const roomMembersOfRoom = roomMembers.filter(
    (m) => m.roomId === sprint.roomId,
  );
  // ⚠️ 방에 멤버가 없는 상황은 시드 설계상 생기지 않지만, 프로덕션 번들이 db.ts 를
  //    빌드 시점에 평가하면서 혹시라도 빈 배열이 생기면 `[0].accountId` 가 터진다.
  //    담당자·보고자를 해석할 수 없으면 그 스프린트는 task 를 만들지 않는다.
  const fallback = roomMembersOfRoom[0];
  if (!fallback) return [];
  const reporterAcc = accounts.find((a) => a.id === fallback.accountId) ?? accounts[0];
  if (!reporterAcc) return [];

  const items = Array.from({ length: 10 }, (_, i) => {
    const status = TASK_STATUSES[i % TASK_STATUSES.length]!;
    const assigneeMember = pick(roomMembersOfRoom);
    const assigneeAcc =
      accounts.find((a) => a.id === assigneeMember.accountId) ?? reporterAcc;
    return {
      id: seq("task"),
      roomId: sprint.roomId,
      sprintId: sprint.id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.paragraph({ min: 1, max: 2 }),
      status,
      priority: pick(["LOW", "NORMAL", "HIGH"] as const),
      assignee: refOf(assigneeAcc),
      reporter: refOf(reporterAcc),
      dueDate: faker.date.soon({ days: 14 }).toISOString().slice(0, 10),
      sortOrder: i,
      sourceCardId: null,
      createdAt: nowIso(),
    } satisfies Task;
  });
  sprint.totalTasks = items.length;
  sprint.doneTasks = items.filter((t) => t.status === "DONE").length;
  return items;
});

// ===== 투표 (VOTE) =====

/**
 * 목 투표. 명세 `VoteDetailResponse` shape 으로 깔아 두고, 목록 조회는
 * server.ts 에서 `VoteSummary` 로 축소한다.
 *
 * ⚠️ 각 방에 유형별(SINGLE / YES_NO / MULTIPLE / CLOSED) 1개씩 섞어서 UI 전부
 *    확인 가능하도록 깐다.
 */
function makeVotes(roomId: number): VoteDetail[] {
  const members = roomMembers.filter((m) => m.roomId === roomId);
  const creator = refOf(
    accounts.find(
      (a) => a.id === members.find((m) => m.role === "OWNER")!.accountId,
    )!,
  );
  const memberCount = members.length;
  const now = Date.now();
  const list: VoteDetail[] = [];

  // 1. SINGLE — 진행 중, 내가 아직 참여 안 함
  list.push({
    voteId: seq("vote"),
    title: "다음 스프린트의 최우선 목표를 선택해주세요",
    voteType: "SINGLE",
    maxSelectCount: 1,
    anonymous: false,
    status: "OPEN",
    deadlineAt: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
    closeReason: null,
    creator,
    sourceCard: null,
    parentVoteId: null,
    version: 1,
    participantCount: Math.min(8, memberCount),
    memberCount,
    participants: members
      .slice(0, Math.min(8, memberCount))
      .map((m) => refOf(accounts.find((a) => a.id === m.accountId)!)),
    myOptionIds: [],
    options: [
      { optionId: seq("voteOption"), content: "온보딩 흐름 개선" },
      { optionId: seq("voteOption"), content: "알림 우선순위 정비" },
      { optionId: seq("voteOption"), content: "모바일 사용성 개선" },
    ],
    tied: false,
  });

  // 2. YES_NO — 진행 중, 내가 이미 찬성
  const yesOpt = seq("voteOption");
  const noOpt = seq("voteOption");
  list.push({
    voteId: seq("vote"),
    title: "정기 회고 시간을 변경할까요?",
    voteType: "YES_NO",
    maxSelectCount: 1,
    anonymous: false,
    status: "OPEN",
    deadlineAt: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
    closeReason: null,
    creator,
    sourceCard: null,
    parentVoteId: null,
    version: 1,
    participantCount: Math.min(8, memberCount),
    memberCount,
    participants: members
      .slice(0, Math.min(8, memberCount))
      .map((m) => refOf(accounts.find((a) => a.id === m.accountId)!)),
    myOptionIds: [yesOpt],
    options: [
      { optionId: yesOpt, content: "찬성" },
      { optionId: noOpt, content: "반대" },
    ],
    tied: false,
  });

  // 3. MULTIPLE — 진행 중, 익명
  list.push({
    voteId: seq("vote"),
    title: "다음 팀 워크숍에서 다룰 주제",
    voteType: "MULTIPLE",
    maxSelectCount: 2,
    anonymous: true,
    status: "OPEN",
    deadlineAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
    closeReason: null,
    creator,
    sourceCard: null,
    parentVoteId: null,
    version: 1,
    participantCount: Math.min(8, memberCount),
    memberCount,
    participants: [], // 익명이라 비노출
    myOptionIds: [],
    options: [
      { optionId: seq("voteOption"), content: "스프린트 회고 포맷 개선" },
      { optionId: seq("voteOption"), content: "주간 1:1 템플릿" },
      { optionId: seq("voteOption"), content: "코드 리뷰 규칙" },
      { optionId: seq("voteOption"), content: "휴가·근무 규정" },
    ],
    tied: false,
  });

  // 4. CLOSED — 마감 완료, 결과 공개 (득표 수 표시)
  const closedOpts = [
    { optionId: seq("voteOption"), content: "매주 월요일 오전", voteCount: 2 },
    { optionId: seq("voteOption"), content: "매주 수요일 오후", voteCount: 6 },
    { optionId: seq("voteOption"), content: "격주 금요일 오후", voteCount: 1 },
  ];
  const maxVote = Math.max(...closedOpts.map((o) => o.voteCount));
  list.push({
    voteId: seq("vote"),
    title: "주간 코드 리뷰 시간 고정",
    voteType: "SINGLE",
    maxSelectCount: 1,
    anonymous: false,
    status: "CLOSED",
    deadlineAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    closeReason: "DEADLINE",
    creator,
    sourceCard: null,
    parentVoteId: null,
    version: 2,
    participantCount: 9,
    memberCount,
    participants: members
      .slice(0, 9)
      .map((m) => refOf(accounts.find((a) => a.id === m.accountId)!)),
    myOptionIds: [closedOpts[1]!.optionId],
    options: closedOpts.map((o) => ({ ...o, top: o.voteCount === maxVote })),
    tied: false,
  });

  return list;
}

export const votes: Array<VoteDetail & { roomId: number }> = rooms.flatMap(
  (room) => makeVotes(room.id).map((v) => ({ ...v, roomId: room.id })),
);

// ===== 캐치업 브리핑 (CATCHUP_BRIEFING) =====

export const boardEvents: BoardEvent[] = rooms.flatMap((room) => {
  const actor = refOf(
    accounts.find(
      (a) =>
        a.id ===
        roomMembers.find((m) => m.roomId === room.id)!.accountId,
    )!,
  );
  const base = [
    {
      kind: "SPRINT_STARTED" as const,
      summary: "스프린트 \"11월 1주차\" 를 시작했습니다.",
    },
    {
      kind: "IDEA_CARD_CREATED" as const,
      summary: "아이디어 보드에 새 카드가 등록됐습니다.",
    },
    {
      kind: "VOTE_OPENED" as const,
      summary: "투표가 시작됐습니다.",
    },
    {
      kind: "MOOD_SUBMITTED" as const,
      summary: "오늘의 상태값이 기록됐습니다.",
    },
  ];
  return base.map((b, i) => ({
    id: seq("event"),
    roomId: room.id,
    kind: b.kind,
    actor,
    summary: b.summary,
    targetType: "ROOM",
    targetId: room.id,
    createdAt: new Date(Date.now() - (base.length - i) * 3600_000).toISOString(),
  }));
});

// ===== 중재 (MEDIATION) =====

export const conflicts: CardConflict[] = rooms.map((room) => {
  const cardsOfRoom = ideaCards.filter((c) => c.roomId === room.id);
  const [a, b] = cardsOfRoom;
  return {
    id: seq("conflict"),
    roomId: room.id,
    leftCardId: a.id,
    rightCardId: b.id,
    leftCardTitle: a.title,
    rightCardTitle: b.title,
    state: "OPEN",
    summary:
      "두 카드가 같은 문제의 해결 방향을 다르게 제안합니다. 절충안이 가능해 보입니다.",
    detectedAt: nowIso(),
  } satisfies CardConflict;
});

export const compromiseDrafts: CompromiseDraft[] = [];

// ===== 알림 (NOTIFICATION) =====

const NOTIFICATION_SEED: Array<{
  kind: Notification["kind"];
  message: string;
  targetUrl: string | null;
  minutesAgo: number;
  read?: boolean;
}> = [
  {
    kind: "TASK_ASSIGNED",
    message: "이주은 님이 \"API 매퍼 정비\" 업무를 담당자로 지정했습니다.",
    targetUrl: "/rooms/1/tasks/1",
    minutesAgo: 3,
  },
  {
    kind: "VOTE_OPENED",
    message: "\"다음 스프린트 포커 포인트 산정\" 투표가 시작되었습니다.",
    targetUrl: "/rooms/1/votes/1",
    minutesAgo: 25,
  },
  {
    kind: "TASK_COMMENT",
    message: "이하연 님이 \"상태값 위젯 구현\" 업무에 댓글을 남겼습니다.",
    targetUrl: "/rooms/1/tasks/2",
    minutesAgo: 120,
  },
  {
    kind: "CONFLICT_DETECTED",
    message: "아이디어 보드에서 충돌 가능성이 있는 카드가 감지되었습니다.",
    targetUrl: "/rooms/1/mediation",
    minutesAgo: 240,
    read: true,
  },
  {
    kind: "ROOM_INVITED",
    message: "김진도 님이 \"26KDT 1팀\" 방에 참여 요청을 보냈습니다.",
    targetUrl: "/rooms/2",
    minutesAgo: 1440,
    read: true,
  },
];

export const notifications: Notification[] = NOTIFICATION_SEED.map((seed) => {
  const createdAt = new Date(Date.now() - seed.minutesAgo * 60_000).toISOString();
  return {
    id: seq("notification"),
    accountId: accounts[0]!.id, // 시드는 홍근 계정으로만
    kind: seed.kind,
    message: seed.message,
    targetUrl: seed.targetUrl,
    readAt: seed.read ? createdAt : null,
    createdAt,
  } satisfies Notification;
});

/** 특정 방의 모든 상태를 한 번에 돌려주는 헬퍼 — 대시보드 초기 렌더용 */
export function getRoomSnapshot(roomId: number) {
  return {
    room: rooms.find((r) => r.id === roomId)!,
    members: roomMembers.filter((m) => m.roomId === roomId),
    widgets: roomWidgets.filter((w) => w.roomId === roomId),
    moodStatuses: moodStatuses.filter((m) => m.roomId === roomId),
    boardSession: boardSessions.find((s) => s.roomId === roomId)!,
    ideaCards: ideaCards.filter((c) => c.roomId === roomId),
    sprint: sprints.find((s) => s.roomId === roomId)!,
    tasks: tasks.filter((t) => t.roomId === roomId),
    votes: votes.filter((v) => v.roomId === roomId),
    boardEvents: boardEvents.filter((e) => e.roomId === roomId),
    conflicts: conflicts.filter((c) => c.roomId === roomId),
  };
}
