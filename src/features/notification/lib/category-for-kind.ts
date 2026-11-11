import type { NotificationKind } from "@/types/db";

/**
 * 알림 섹션 분류 — 드로워 안에서 카테고리별로 묶어 보여 준다.
 *
 * ⚠️ 디자인 기준: Figma Make 의 알림 드로워가 카테고리 라벨(내 활동/업무/투표…) 로
 *    아이템을 섹션 분리한다. 우리 도메인(갈등·중재) 에 맞춰 이름만 조정한다.
 */
export type NotificationCategory =
  | "내 활동"
  | "업무"
  | "투표"
  | "갈등·중재"
  | "멤버 및 권한"
  | "시스템";

export const NOTIFICATION_CATEGORY_ORDER: readonly NotificationCategory[] = [
  "내 활동",
  "업무",
  "투표",
  "갈등·중재",
  "멤버 및 권한",
  "시스템",
];

export function categoryForNotificationKind(
  kind: NotificationKind,
): NotificationCategory {
  switch (kind) {
    case "IDEA_CARD_COMMENT":
      return "내 활동";
    case "TASK_ASSIGNED":
    case "TASK_UNASSIGNED":
    case "TASK_COMMENT":
      return "업무";
    case "VOTE_OPENED":
    case "VOTE_CLOSED":
      return "투표";
    case "CONFLICT_DETECTED":
    case "MEDIATION_ADOPTED":
      return "갈등·중재";
    case "ROOM_INVITED":
    case "ROOM_KICKED":
      return "멤버 및 권한";
    case "SYSTEM":
    default:
      return "시스템";
  }
}
