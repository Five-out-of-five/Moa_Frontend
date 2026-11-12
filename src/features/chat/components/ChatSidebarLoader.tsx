import { listMyChannels, listMyDmThreads } from "../server";
import { ChatSidebar, ChatSidebarFallback } from "./ChatSidebar";

/**
 * 셸 좌측 사이드바의 서버 측 로더. 내가 볼 수 있는 모든 채널·DM 을 한 번에 가져와 주입한다.
 * "현재 어느 방을 보고 있는가" 는 사이드바 쪽에서 URL 로 판단하므로 서버는 모름.
 *
 * 실패해도 쉘 본문은 그대로 렌더되도록 fallback 스켈레톤으로 떨어뜨린다.
 */
export async function ChatSidebarLoader() {
  try {
    const [channels, dms] = await Promise.all([
      listMyChannels(),
      listMyDmThreads(),
    ]);
    return <ChatSidebar channels={channels} dms={dms} />;
  } catch (error) {
    // 조용히 삼키면 BE/네트워크 문제를 운영 지표로 잡을 수 없다 — 서버 로그에만 남기고
    // 사용자 UI 는 스켈레톤으로 떨어뜨린다 (쉘 본문은 영향받지 않음).
    console.error("ChatSidebarLoader failed:", error);
    return <ChatSidebarFallback />;
  }
}
