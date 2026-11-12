import {
  ClipboardCheck,
  MessageCircle,
  ShieldCheck,
  Users,
  Vote,
  Zap,
} from "lucide-react";

import type { NotificationGroup } from "@/types/db";

/**
 * 알림 섹션(`group`) 별 좌측 아이콘. 라운드 사각형 안에 들어간다.
 *
 * ⚠️ type 문자열 enum 이 명세에 명시되지 않아, 아이콘은 **group 단위**로 정한다.
 *    더 세분화된 매핑은 BE 가 type enum 을 열어 주면 그때 추가한다.
 */
const ICON_FOR_GROUP: Record<NotificationGroup, typeof MessageCircle> = {
  MY_ACTIVITY: MessageCircle,
  TASK: ClipboardCheck,
  VOTE: Vote,
  SESSION: Zap,
  MEMBER_ROLE: Users,
  SYSTEM: ShieldCheck,
};

export function iconForNotificationGroup(group: NotificationGroup) {
  return ICON_FOR_GROUP[group];
}
