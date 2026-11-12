import type { Notification } from "@/types/db";

/**
 * 알림의 이동 목적지 URL 조립 — 명세상 BE 는 `room + targetType + targetId` 만 내려 주고
 * FE 가 라우트 규칙에 맞춰 URL 을 만든다.
 *
 * ⚠️ **현재 FE 에 구현된 라우트만** 분기하고, 나머지는 **방 홈** (`/rooms/{roomId}`) 으로
 *    떨어뜨린다. 존재하지 않는 경로로 가서 404 뜨는 것보다 방 홈에서 사용자가 직접 찾아가는
 *    쪽이 덜 당황스럽다. 각 상세 라우트 (업무·아이디어·중재 등) 가 생기면 그때 switch 를
 *    넓힌다. 방 홈 자체도 아직 placeholder 라 그 뒤에 들어와야 완전 복구됨 — 그래도
 *    임의 404 보다는 안전.
 *
 * ⚠️ 투표 상세는 `/rooms/{roomId}/votes` 목록으로 보내고 Sheet 가 열리기만 하면 되도록
 *    목록 페이지의 쿼리 (`?open={id}`) 로 연다 (이번 PR 에서 추가).
 */
export function targetUrlOfNotification(n: Notification): string {
  const roomId = n.room.roomId;
  switch (n.targetType) {
    case "vote":
      return `/rooms/${roomId}/votes?open=${n.targetId}`;
    case "task":
      return `/rooms/${roomId}/boards/task?open=${n.targetId}`;
    case "room":
    default:
      return `/rooms/${roomId}`;
  }
}
