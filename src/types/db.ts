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
export type TaskSourceType = "NONE" | "CARD" | "VOTE";

/** 명세 `Sprint`. 위젯/진척도용 요약. */
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

/** 명세 `TaskSource` — 업무가 어느 카드/투표에서 전환됐는지 */
export interface TaskSource {
  type: TaskSourceType;
  id: number | null;
  title: string | null;
  writerDisplayName?: string | null;
}

/**
 * 명세 `TaskSummaryResponse` — 칸반 보드 각 카드가 쓰는 요약 shape.
 *
 * ⚠️ `dDay` 는 BE 가 계산해서 내려 준다 (양수=남음, 0=오늘, 음수=지남).
 * ⚠️ `assignee` 는 미담당이면 null.
 */
export interface TaskSummary {
  taskId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dDay: number | null;
  overdue: boolean;
  sortOrder: number;
  version: number;
  registrant: MemberRef;
  assignee: MemberRef | null;
  source: TaskSource;
}

/** 명세 `TaskHistoryItem` — 상태/담당자 변경 이력 */
export type TaskHistoryType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "REJECTED";

export interface TaskHistoryItem {
  historyType: TaskHistoryType;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  fromAssignee: MemberRef | null;
  toAssignee: MemberRef | null;
  actor: MemberRef;
  createdAt: string;
}

/** 명세 `FileResponse` — 업무 첨부 (여기선 참조용 필드만 필요한 만큼) */
export interface TaskFileRef {
  fileId: number;
  name: string;
  byteSize: number;
  mimeType: string;
  createdAt: string;
}

/** 명세 `TaskDetailResponse` — 상세 조회·쓰기 액션 응답 */
export interface TaskDetail extends TaskSummary {
  description: string;
  completedAt: string | null;
  files: TaskFileRef[];
  history: TaskHistoryItem[];
  createdAt: string;
}

// ===== 위젯 · 투표 (VOTE) =====

export type VoteType = "SINGLE" | "MULTIPLE" | "APPROVAL";
export type VoteState = "OPEN" | "CLOSED";

export interface VoteOption {
  id: number;
  voteId: number;
  content: string;
  tally: number; // 득표 수 (집계된 값만 노출)
}

export interface Vote {
  id: number;
  roomId: number;
  title: string;
  description: string | null;
  voteType: VoteType;
  maxSelections: number;
  anonymous: boolean;
  state: VoteState;
  deadline: string | null;
  options: VoteOption[];
  author: MemberRef;
  sourceCardId: number | null;
  createdAt: string;
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
 * 알림 종류 — 명세 §notification.
 * 각 종류별로 드롭다운에서 다른 아이콘을 쓴다.
 */
export type NotificationKind =
  | "TASK_ASSIGNED"
  | "TASK_UNASSIGNED"
  | "TASK_COMMENT"
  | "IDEA_CARD_COMMENT"
  | "VOTE_OPENED"
  | "VOTE_CLOSED"
  | "ROOM_INVITED"
  | "ROOM_KICKED"
  | "CONFLICT_DETECTED"
  | "MEDIATION_ADOPTED"
  | "SYSTEM";

export interface Notification {
  id: number;
  accountId: number;
  kind: NotificationKind;
  /** 화면에 그대로 띄우는 한국어 문장 (BE 가 생성, 코드에서 조립 금지) */
  message: string;
  /** 눌렀을 때 이동할 URL. 없으면 알림만 읽음 처리. */
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
