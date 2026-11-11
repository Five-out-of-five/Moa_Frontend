import { getMyAccount } from "@/features/account/server";

import { listMyRooms } from "../server";
import {
  WorkspaceSwitcher,
  WorkspaceSwitcherFallback,
} from "./WorkspaceSwitcher";

/**
 * 헤더 좌측 워크스페이스 드롭다운의 서버 측 로더.
 *
 * ⚠️ 방 목록과 내 계정(마지막 접속 방 fallback 제공용) 을 **독립적으로 대기**한다.
 *    계정 조회가 실패해도 `WorkspaceSwitcher` 는 URL 의 방 ID 또는 첫 방으로 떨어지면
 *    되므로 switcher 자체를 숨길 필요가 없다. 방 목록 조회 자체가 실패할 때만 스켈레톤
 *    fallback 으로 떨어뜨린다.
 */
export async function WorkspaceSwitcherLoader() {
  const [roomsResult, meResult] = await Promise.allSettled([
    listMyRooms(),
    getMyAccount(),
  ]);

  if (roomsResult.status === "rejected") {
    console.error(
      "WorkspaceSwitcherLoader rooms failed:",
      roomsResult.reason,
    );
    return <WorkspaceSwitcherFallback />;
  }

  if (meResult.status === "rejected") {
    console.error(
      "WorkspaceSwitcherLoader me failed:",
      meResult.reason,
    );
  }

  const fallbackRoomId =
    meResult.status === "fulfilled" ? meResult.value.lastRoomId : null;

  return (
    <WorkspaceSwitcher rooms={roomsResult.value} fallbackRoomId={fallbackRoomId} />
  );
}
