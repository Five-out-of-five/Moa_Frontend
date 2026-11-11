import {
  AlertTriangle,
  Bell,
  CheckSquare,
  Handshake,
  MessageSquare,
  UserMinus,
  UserPlus,
  Vote,
} from "lucide-react";

import type { NotificationKind } from "@/types/db";

/**
 * 알림 종류별 아이콘 매핑 — 드롭다운 항목 좌측에 쓰인다.
 *
 * ⚠️ 하나의 함수에 몰아 두는 이유: 알림 종류가 늘어나면 매핑도 한 곳만 보면 된다.
 *    이모지로 대체하지 않는다 — 다크 모드·접근성·일관성 면에서 Lucide 아이콘이 낫다.
 */
export function iconForNotificationKind(kind: NotificationKind) {
  switch (kind) {
    case "TASK_ASSIGNED":
      return CheckSquare;
    case "TASK_UNASSIGNED":
      return UserMinus;
    case "TASK_COMMENT":
    case "IDEA_CARD_COMMENT":
      return MessageSquare;
    case "VOTE_OPENED":
    case "VOTE_CLOSED":
      return Vote;
    case "ROOM_INVITED":
      return UserPlus;
    case "ROOM_KICKED":
      return UserMinus;
    case "CONFLICT_DETECTED":
      return AlertTriangle;
    case "MEDIATION_ADOPTED":
      return Handshake;
    case "SYSTEM":
    default:
      return Bell;
  }
}
