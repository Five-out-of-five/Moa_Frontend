import type { Notification } from "@/types/db";

/**
 * 알림의 이동 목적지 URL 조립 — 명세상 BE 는 `room + targetType + targetId` 만 내려 주고
 * FE 가 라우트 규칙에 맞춰 URL 을 만든다.
 *
 * ⚠️ targetType enum 은 명세에 명시되지 않아 알려진 값만 분기하고, 나머지는 방 홈으로
 *    떨어뜨린다. BE 와 함께 enum 화되면 switch 를 좁힌다.
 */
export function targetUrlOfNotification(n: Notification): string {
  const roomId = n.room.roomId;
  switch (n.targetType) {
    case "task":
      return `/rooms/${roomId}/boards/task?id=${n.targetId}`;
    case "idea":
      return `/rooms/${roomId}/boards/idea?id=${n.targetId}`;
    case "vote":
      return `/rooms/${roomId}/votes/${n.targetId}`;
    case "mediation":
      return `/rooms/${roomId}/mediation`;
    case "briefing":
      return `/rooms/${roomId}#briefing`;
    case "room":
    default:
      return `/rooms/${roomId}`;
  }
}
