/**
 * MOA DB 스키마의 TS 거울 — 46개 테이블 중 FE 가 직접 보는 핵심만 정의.
 *
 * ⚠️ 이 파일은 **BE 테이블정의서의 거울**이다. BE 가 컬럼을 바꾸면 여기도 바꾼다.
 *    enum 값은 DB 와 동일한 `대문자 스네이크` 로 유지한다 (JPA `@Enumerated(STRING)` 호환).
 *
 * ⚠️ 응답 매퍼는 **공용 봉투**(`{ success, data }`) 를 벗긴 뒤 이 타입으로 만든다.
 *    컴포넌트는 봉투를 모른다.
 */

// ===== 공통 =====

/** 작성자·담당자·발신자 등 사람을 가리키는 공용 참조 — API 명세 §MemberRef */
export interface MemberRef {
  accountId: number;
  displayName: string;
  profileImageUrl: string | null;
  memberStatus: MemberStatus;
}

export type MemberStatus = "ACTIVE" | "LEFT" | "KICKED" | "WITHDRAWN";

/** 목록 응답 — 공용 페이지네이션 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

/** 커서 페이지네이션 — 채팅·AI 이력 전용 */
export interface CursorResponse<T> {
  items: T[];
  hasNext: boolean;
  nextCursor: number | null;
}

// ===== 회원 =====

export type SocialProvider = "GOOGLE" | "KAKAO" | "NAVER";
export type ToneMode = "OFF" | "POLISH" | "POLITE";
export type AccountRole = "USER" | "ADMIN";

export interface Account {
  id: number;
  provider: SocialProvider;
  name: string;
  email: string;
  role: AccountRole;
  toneMode: ToneMode;
  lastRoomId: number | null;
  createdAt: string; // ISO-8601 (KST)
}

// ===== 워크스페이스 =====

export type RoomMemberRole = "OWNER" | "MEMBER";
export type RoomMemberState = "ACTIVE" | "LEFT" | "KICKED";

export interface Room {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  memberCount: number;
  maxMemberCount: 20; // 앱 상수 (room_member 테이블 §비고)
  createdAt: string;
}

export interface RoomMember {
  id: number;
  roomId: number;
  accountId: number;
  nickname: string | null;
  role: RoomMemberRole;
  state: RoomMemberState;
  notificationMuted: boolean;
  lastBriefingCheckedAt: string | null;
  joinedAt: string;
}

// ===== 대시보드·위젯 =====

/** 위젯 종류 — 명세 7종 (방당 종류별 1개, uk_room_widget_type) */
export type WidgetType =
  | "MOOD"
  | "IDEA_BOARD"
  | "TASK_BOARD"
  | "PROGRESS"
  | "VOTE"
  | "CATCHUP_BRIEFING"
  | "MEDIATION";

export interface RoomWidget {
  id: number;
  roomId: number;
  widgetType: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ===== 위젯 · 상태값 (MOOD) =====

export type MoodLevel = "GREAT" | "GOOD" | "SOSO" | "TIRED" | "BAD";

export interface MoodStatus {
  id: number;
  roomId: number;
  accountId: number;
  mood: MoodLevel;
  note: string | null;
  recordedDate: string; // yyyy-MM-dd (KST)
}

// ===== 위젯 · 아이디어보드 (IDEA_BOARD) =====

export type IdeaCardType = "AGENDA" | "KEEP" | "PROBLEM" | "TRY";
export type BoardSessionState = "ACTIVE" | "CLOSED";

export interface BoardSession {
  id: number;
  roomId: number;
  title: string;
  state: BoardSessionState;
  startsAt: string;
  endsAt: string | null;
}

export interface IdeaCard {
  id: number;
  roomId: number;
  sessionId: number;
  cardType: IdeaCardType;
  title: string;
  content: string;
  author: MemberRef;
  sortOrder: number;
  commentCount: number;
  reactionCount: number;
  convertedTaskId: number | null;
  createdAt: string;
}

// ===== 위젯 · 업무보드 (TASK_BOARD) =====

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH";

export interface Sprint {
  id: number;
  roomId: number;
  name: string;
  state: BoardSessionState; // 공용 재사용
  startsAt: string;
  endsAt: string | null;
  totalTasks: number;
  doneTasks: number;
}

export interface Task {
  id: number;
  roomId: number;
  sprintId: number | null; // null = 백로그
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: MemberRef | null;
  reporter: MemberRef;
  dueDate: string | null; // yyyy-MM-dd
  sortOrder: number;
  sourceCardId: number | null;
  createdAt: string;
}

// ===== 위젯 · 투표 (VOTE) =====

/** 명세 `voteType`. `APPROVAL` 은 명세의 `YES_NO` 와 동일 (찬반) — BE 명세 용어로 통일. */
export type VoteType = "SINGLE" | "MULTIPLE" | "YES_NO";

/** 명세 `status` — OPEN / CLOSED. 기존 `state` 네이밍을 명세와 맞춤. */
export type VoteStatus = "OPEN" | "CLOSED";

/** 명세 `closeReason` — 마감 사유. */
export type VoteCloseReason =
  | "DEADLINE"
  | "ALL_VOTED"
  | "MANUAL"
  | "NO_PARTICIPANT";

/**
 * 투표 옵션 — 명세 `VoteDetailResponse.options[]` 요소.
 *
 * ⚠️ `voteCount` 는 **마감 후에만** 서버가 내려준다. 진행 중엔 null/undefined.
 *    `top` 은 최다 득표 선택지(마감 후). 동점이면 상위 공동 top 모두 true.
 */
export interface VoteOption {
  optionId: number;
  content: string;
  voteCount?: number;
  top?: boolean;
}

/** 명세 `VoteSummaryResponse` — 목록에서 받는 간이 shape. */
export interface VoteSummary {
  voteId: number;
  title: string;
  voteType: VoteType;
  status: VoteStatus;
  deadlineAt: string;
  participantCount: number;
  memberCount: number;
  /** 내가 이미 참여했는가 — 목록 카드의 하단 상태 라벨에 사용 */
  votedByMe: boolean;
  sourceCardId: number | null;
}

/** 투표 원천 카드 — 안건 카드에서 생성된 경우 참조 */
export interface VoteSourceCard {
  cardId: number;
  title: string;
}

/**
 * 명세 `VoteDetailResponse` — 상세 조회 / 생성·참여·마감 등 쓰기 응답.
 *
 * ⚠️ `participants` 는 익명 투표일 때 빈 배열. 마감 후에도 공개하지 않는다.
 * ⚠️ `myOptionIds` 가 참여한 선택지 — 재참여 시 UI 초기값.
 */
export interface VoteDetail {
  voteId: number;
  title: string;
  voteType: VoteType;
  maxSelectCount: number;
  anonymous: boolean;
  status: VoteStatus;
  deadlineAt: string;
  closeReason: VoteCloseReason | null;
  creator: MemberRef;
  sourceCard: VoteSourceCard | null;
  parentVoteId: number | null;
  version: number;
  participantCount: number;
  memberCount: number;
  participants: MemberRef[];
  myOptionIds: number[];
  options: VoteOption[];
  tied: boolean;
}

// ===== 위젯 · 캐치업 브리핑 (CATCHUP_BRIEFING) =====

export type BoardEventKind =
  | "IDEA_CARD_CREATED"
  | "IDEA_CARD_CONVERTED"
  | "TASK_STATUS_CHANGED"
  | "VOTE_OPENED"
  | "VOTE_CLOSED"
  | "SESSION_STARTED"
  | "SESSION_CLOSED"
  | "SPRINT_STARTED"
  | "SPRINT_CLOSED"
  | "MOOD_SUBMITTED"
  | "CONFLICT_DETECTED";

export interface BoardEvent {
  id: number;
  roomId: number;
  kind: BoardEventKind;
  actor: MemberRef;
  summary: string;
  targetType: string;
  targetId: number;
  createdAt: string;
}

// ===== 중재 (MEDIATION) =====

export type ConflictState = "OPEN" | "RESOLVED" | "DISMISSED";

export interface CardConflict {
  id: number;
  roomId: number;
  leftCardId: number;
  rightCardId: number;
  leftCardTitle: string;
  rightCardTitle: string;
  state: ConflictState;
  summary: string; // AI 가 낸 "왜 충돌이라 보는가"
  detectedAt: string;
}

export interface CompromiseDraft {
  id: number;
  conflictId: number;
  content: string;
  requestedBy: MemberRef;
  adoptedCardId: number | null;
  createdAt: string;
}

// ===== 알림 (NOTIFICATION) =====

/**
 * 알림 섹션 분류 — 10/28 명세의 `group` enum. 드로워에서 섹션 라벨로 쓴다.
 *
 * ⚠️ BE `/v3/api-docs` URL 이 공유되면 이 타입은 자동 생성된 `src/types/api.d.ts`
 *    의 `components["schemas"]["NotificationResponse"]["group"]` 로 승격한다
 *    (지금은 수동 유지).
 */
export type NotificationGroup =
  | "MY_ACTIVITY"
  | "TASK"
  | "VOTE"
  | "SESSION"
  | "MEMBER_ROLE"
  | "SYSTEM";

/**
 * 알림 세부 종류 — BE 가 보내는 type 문자열. 명세에 enum 리스트가 명시되지 않아
 * string 으로 열어 둔다. FE 는 group 으로만 분류·아이콘을 결정한다 (type 은 추후
 * 더 세분화된 UI 가 필요할 때 사용).
 */
export type NotificationType = string;

export interface NotificationRoomRef {
  roomId: number;
  name: string;
}

/**
 * 알림 응답 shape — 10/28 명세 `NotificationResponse`.
 *
 * ⚠️ 이동 목적지는 `room + targetType + targetId` 조합으로 **FE 가 URL 을 조립**한다
 *    (명세에 명시). targetType 값은 명세 운영 중 BE 와 함께 enum 화 예정.
 */
export interface Notification {
  notificationId: number;
  group: NotificationGroup;
  type: NotificationType;
  /** 드로워 각 항목의 **제목** — BE 가 생성, FE 는 그대로 노출 */
  title: string;
  /** 제목 아래 보조 설명 — BE 가 생성 */
  content: string;
  room: NotificationRoomRef;
  /** `task` / `idea` / `vote` / `session` / `briefing` / `mediation` / `room` 등 — FE 가 URL 조립에 사용 */
  targetType: string;
  targetId: number;
  read: boolean;
  createdAt: string;
}
