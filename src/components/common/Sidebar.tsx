import { Suspense } from "react";

import { ChatSidebarFallback } from "@/features/chat/components/ChatSidebar";
import { ChatSidebarLoader } from "@/features/chat/components/ChatSidebarLoader";

/**
 * 공용 좌측 사이드바 — 로그인 뒤 전역 쉘의 좌측 자리. 현재는 **채팅 채널·DM 리스트** 를
 * 담는다. 폭(`--sidebar-width` 228px) 은 Header 의 로고 영역과 수직으로 맞춰 둔다.
 *
 * ⚠️ 사이드바 **내용물의 소유권은 각 피처(feature/chat)** 에 있다. 셸은 위치만 보장하고,
 *    내부는 Suspense 로 감싸 피처의 서버 로더가 실패하거나 느려도 쉘 본문 렌더를 막지 않는다.
 */
export function Sidebar() {
  return (
    <Suspense fallback={<ChatSidebarFallback />}>
      <ChatSidebarLoader />
    </Suspense>
  );
}
