import { listMyRooms } from "../server";
import {
  WorkspaceSwitcher,
  WorkspaceSwitcherErrorState,
} from "./WorkspaceSwitcher";

/**
 * 헤더 좌측 워크스페이스 드롭다운의 서버 측 로더.
 *
 * ⚠️ 방 목록만 기다린다 — `Account.lastRoomId` fallback 은 **부가적**이기 때문에, 그 요청을
 *    여기서 함께 await 하면 account 가 멈출 때 switcher 전체가 함께 지연된다. 로그인한 뒤
 *    "어느 방으로 바로 보낼지" 는 랜딩 라우트가 알아서 하면 되고, switcher 는 URL 의
 *    `/rooms/{id}` 또는 첫 방으로 선택을 떨어뜨릴 수 있다 (`fallbackRoomId={null}`).
 * ⚠️ 실패 시 로딩 스켈레톤을 유지하지 않는다 — 요청이 끝났는데 스켈레톤을 그대로 두면
 *    사용자는 switcher 와 그 아래 내비게이션을 영영 쓸 수 없다. 재시도 버튼이 있는
 *    `WorkspaceSwitcherErrorState` 로 떨어뜨린다.
 */
export async function WorkspaceSwitcherLoader() {
  try {
    const rooms = await listMyRooms();
    return <WorkspaceSwitcher rooms={rooms} fallbackRoomId={null} />;
  } catch (error) {
    console.error("WorkspaceSwitcherLoader failed:", error);
    return <WorkspaceSwitcherErrorState />;
  }
}
