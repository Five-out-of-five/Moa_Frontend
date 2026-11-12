import type { NotificationGroup } from "@/types/db";

/**
 * 서버가 내려주는 `group` enum 을 드로워 섹션 라벨로 변환.
 *
 * ⚠️ 명세의 group 자체가 섹션 분류 역할이라 FE 는 **문자열 치환만** 담당한다
 *    (과거에 kind → category 를 FE 가 매핑하던 로직은 폐기).
 */
export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  MY_ACTIVITY: "내 활동",
  TASK: "업무",
  VOTE: "투표",
  SESSION: "회차",
  MEMBER_ROLE: "멤버 및 권한",
  SYSTEM: "시스템",
};

export const NOTIFICATION_GROUP_ORDER: readonly NotificationGroup[] = [
  "MY_ACTIVITY",
  "TASK",
  "VOTE",
  "SESSION",
  "MEMBER_ROLE",
  "SYSTEM",
];
