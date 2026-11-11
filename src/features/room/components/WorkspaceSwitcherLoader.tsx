import { getMyAccount } from "@/features/account/server";

import { listMyRooms } from "../server";
import {
  WorkspaceSwitcher,
  WorkspaceSwitcherFallback,
} from "./WorkspaceSwitcher";

/**
 * 헤더 좌측 워크스페이스 드롭다운의 서버 측 로더. 내가 속한 방 목록과 마지막으로
 * 들어간 방(fallback) 을 한 번에 가져와 switcher 에 주입한다.
 */
export async function WorkspaceSwitcherLoader() {
  try {
    const [rooms, me] = await Promise.all([listMyRooms(), getMyAccount()]);
    return (
      <WorkspaceSwitcher rooms={rooms} fallbackRoomId={me.lastRoomId} />
    );
  } catch {
    return <WorkspaceSwitcherFallback />;
  }
}
