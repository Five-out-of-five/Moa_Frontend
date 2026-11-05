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
  Room,
  RoomMember,
  RoomWidget,
  Sprint,
  Task,
  TaskStatus,
  Vote,
  VoteOption,
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
  makeAccount("박지은", "jieun@example.com"),
  makeAccount("김승재", "seungjae@example.com"),
  makeAccount("최진도", "jindo@example.com"),
  makeAccount("한주은", "jueun@example.com"),
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
  const items = Array.from({ length: 10 }, (_, i) => {
    const status = TASK_STATUSES[i % TASK_STATUSES.length];
    const reporter = accounts.find(
      (a) => a.id === roomMembersOfRoom[0].accountId,
    )!;
    const assignee = accounts.find(
      (a) => a.id === pick(roomMembersOfRoom).accountId,
    )!;
    return {
      id: seq("task"),
      roomId: sprint.roomId,
      sprintId: sprint.id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.paragraph({ min: 1, max: 2 }),
      status,
      priority: pick(["LOW", "NORMAL", "HIGH"] as const),
      assignee: refOf(assignee),
      reporter: refOf(reporter),
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

export const votes: Vote[] = rooms.flatMap((room) => {
  const author = refOf(
    accounts.find(
      (a) =>
        a.id ===
        roomMembers.find((m) => m.roomId === room.id && m.role === "OWNER")!
          .accountId,
    )!,
  );
  return [
    {
      id: seq("vote"),
      roomId: room.id,
      title: "다음 스프린트 포커 포인트 산정",
      description: "회고에서 나온 문제 중 우선 해결할 것 선택",
      voteType: "SINGLE" as const,
      maxSelections: 1,
      anonymous: false,
      state: "OPEN" as const,
      deadline: faker.date.soon({ days: 3 }).toISOString(),
      options: ["API 응답 속도", "AI 토큰 비용", "온보딩 UX"].map((c) => ({
        id: seq("voteOption"),
        voteId: 0,
        content: c,
        tally: faker.number.int({ min: 0, max: 5 }),
      })) as VoteOption[],
      author,
      sourceCardId: null,
      createdAt: nowIso(),
    } satisfies Vote,
  ];
});

// voteOption 의 voteId 뒤에 채운다
for (const v of votes) {
  for (const opt of v.options) opt.voteId = v.id;
}

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
