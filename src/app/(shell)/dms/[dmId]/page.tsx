import { notFound } from "next/navigation";

import { getMyAccount } from "@/features/account/server";
import { DmPageClient } from "@/features/chat/components/DmPageClient";
import { getDmMessages, getDmThread } from "@/features/chat/server";

interface Props {
  params: Promise<{ dmId: string }>;
}

/**
 * 1:1 메시지 스레드 페이지 — `/dms/[dmId]` 라우트. 방 밖에 둔 이유는 `ChatSidebar` 가 DM 을
 * 방에 소속시키지 않고 "내 DM" 으로만 묶기 때문 (상대방이 여러 방에 걸칠 수 있다).
 *
 * ⚠️ 채널 쪽과 같이 **WebSocket 없이 로컬 state 전송만**. 소켓 전환은 BE 확정 뒤 후속 PR.
 */
export default async function DmPage({ params }: Props) {
  const { dmId: dmIdParam } = await params;
  const dmId = Number(dmIdParam);
  if (!Number.isFinite(dmId)) notFound();

  const [thread, messages, meResult] = await Promise.all([
    getDmThread(dmId),
    getDmMessages(dmId).catch((e) => {
      console.error(`DmPage getDmMessages failed (dmId=${dmId}):`, e);
      return [];
    }),
    (async () => {
      try {
        const me = await getMyAccount();
        return { accountId: me.id, displayName: me.name };
      } catch (e) {
        console.error("DmPage getMyAccount failed:", e);
        return null;
      }
    })(),
  ]);

  if (!thread) notFound();

  return <DmPageClient thread={thread} initialMessages={messages} me={meResult} />;
}
