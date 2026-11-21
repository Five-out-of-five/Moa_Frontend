import { notFound } from "next/navigation";

import { getMyAccount } from "@/features/account/server";
import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { ChannelPageClient } from "@/features/chat/components/ChannelPageClient";
import { getChannel, getChannelMessages } from "@/features/chat/server";

interface Props {
  params: Promise<{ roomId: string; channelId: string }>;
  searchParams: Promise<{ briefingFocus?: string | string[] }>;
}

/**
 * 방 안 채널의 메시지 페이지 — `ChatSidebar` 가 가리키는 라우트.
 *
 * ⚠️ WebSocket 연결은 아직 없음 — 초기 메시지만 서버에서 선패치해 넘기고, 전송은 client 에서
 *    로컬 state 로만 반영한다. 소켓 전환은 BE 토큰/엔드포인트 확정 뒤 후속 PR.
 * ⚠️ 채널 조회가 null (사이드바에 남아 있지만 서버에서 지워진 등) 이면 404 로 떨어뜨린다.
 */
export default async function RoomChannelPage({ params, searchParams }: Props) {
  const [{ roomId: roomIdParam, channelId: channelIdParam }, query] = await Promise.all([params, searchParams]);
  const roomId = Number(roomIdParam);
  const channelId = Number(channelIdParam);
  if (!Number.isFinite(roomId) || !Number.isFinite(channelId)) notFound();

  const [channel, messages, meResult] = await Promise.all([
    getChannel(roomId, channelId),
    getChannelMessages(roomId, channelId).catch((e) => {
      // 메시지 1회 조회 실패는 **빈 리스트 + Hero** 로 떨어뜨린다 — 헤더/입력창까지 못 보면
      // "채널 자체가 안 열림" 처럼 느껴져 재시도 유도가 더 어렵다 (CodeRabbit 류 리스크).
      console.error(
        `RoomChannelPage getChannelMessages failed (roomId=${roomId}, channelId=${channelId}):`,
        e,
      );
      return [];
    }),
    (async () => {
      try {
        const me = await getMyAccount();
        return { accountId: me.id, displayName: me.name };
      } catch (e) {
        console.error("RoomChannelPage getMyAccount failed:", e);
        return null;
      }
    })(),
  ]);

  if (!channel) notFound();

  return (
    <>
      <ChannelPageClient channel={channel} initialMessages={messages} me={meResult} />
      <BriefingFocus ids={readBriefingFocus(query.briefingFocus)} />
    </>
  );
}
