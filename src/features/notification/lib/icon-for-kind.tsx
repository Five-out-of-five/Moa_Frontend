import {
  ClipboardCheck,
  Handshake,
  MessageCircle,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Vote,
} from "lucide-react";

import type { NotificationKind } from "@/types/db";

/**
 * 알림 종류별 아이콘 매핑 — 드로워 각 항목의 좌측 라운드 사각형 안에 들어간다.
 *
 * ⚠️ 디자인 기준: Figma Make 알림 드로워. 카테고리 섹션과 톤을 맞춰 Lucide 아이콘을 쓰고,
 *    이모지로 대체하지 않는다 (다크 모드·접근성·일관성 유지).
 */
export function iconForNotificationKind(kind: NotificationKind) {
  switch (kind) {
    case "IDEA_CARD_COMMENT":
      return MessageCircle;
    case "TASK_ASSIGNED":
    case "TASK_UNASSIGNED":
    case "TASK_COMMENT":
      return ClipboardCheck;
    case "VOTE_OPENED":
    case "VOTE_CLOSED":
      return Vote;
    case "CONFLICT_DETECTED":
      return Handshake;
    case "MEDIATION_ADOPTED":
      return Handshake;
    case "ROOM_INVITED":
      return UserPlus;
    case "ROOM_KICKED":
      return UserMinus;
    case "SYSTEM":
    default:
      return ShieldCheck;
  }
}
