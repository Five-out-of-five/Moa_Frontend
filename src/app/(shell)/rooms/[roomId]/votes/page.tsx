import { notFound } from "next/navigation";

import { getMyAccount } from "@/features/account/server";
import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { loadIdeaCardDetail } from "@/features/idea/discussion-actions";
import { listMyRooms } from "@/features/room/server";
import { VotesPageClient } from "@/features/vote/components/VotesPageClient";
import { getVoteDetail, listVotesInRoom } from "@/features/vote/server";
import type { VoteDetail } from "@/types/db";

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{
    open?: string | string[];
    briefingFocus?: string;
    /** 아이디어 카드에서 "투표로 전환" 눌러 넘어온 경우. VoteCreateDialog 를 자동으로 연다. */
    sourceCard?: string;
  }>;
}

/**
 * 방 안의 투표 전체 보기 — 명세 10/28 `Vote` 도메인.
 *
 * ⚠️ 상세는 **page 에서 미리 함께 fetch** 해 client 에 넘긴다. 목록이 보통 10~20개 단위라
 *    Sheet 열 때마다 왕복하지 않아도 되고, 목에서는 서버 왕복 자체가 없다. 실서버로 전환
 *    했을 때 비용이 커지면 `getVoteDetailAction` 으로 lazy 전환하면 된다.
 */
export default async function RoomVotesPage({ params, searchParams }: Props) {
  const { roomId: roomIdParam } = await params;
  const { open: openRaw, briefingFocus, sourceCard: sourceCardParam } = await searchParams;
  const roomId = Number(roomIdParam);
  if (!Number.isFinite(roomId)) notFound();

  // 알림 등에서 `?open={voteId}` 로 들어오면 그 투표의 Sheet 를 바로 연다.
  // 배열로 들어오면 첫 값, 숫자 아니면 null.
  const openParam = Array.isArray(openRaw) ? openRaw[0] : openRaw;
  const openVoteId =
    openParam && Number.isFinite(Number(openParam))
      ? Number(openParam)
      : null;

  // 아이디어 카드 → 투표 전환 쿼리. 카드 title·content 를 prefill 로 넘긴다.
  const sourceCardId =
    sourceCardParam && Number.isFinite(Number(sourceCardParam))
      ? Number(sourceCardParam)
      : null;
  const sourceCard = sourceCardId != null
    ? await (async () => {
        try {
          const detail = await loadIdeaCardDetail(roomId, sourceCardId);
          if (!("card" in detail) || !detail.card) return null;
          const { card } = detail;
          if (card.cardId == null || !card.title) return null;
          return { id: card.cardId, title: card.title, content: card.content ?? "" };
        } catch (e) {
          console.error(`RoomVotesPage loadIdeaCardDetail failed (cardId=${sourceCardId}):`, e);
          return null;
        }
      })()
    : null;

  // listMyRooms 는 사이드바·헤더 작업에서 이미 공용으로 쓰이는 조회 — 방 이름만 뽑아 쓴다.
  const rooms = await listMyRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  // ⚠️ 내 계정 조회가 실패해도 **투표 목록은 열려야** 한다 — 작성자 전용 관리 메뉴만
  //    노출이 숨겨질 뿐 조회·참여는 정상. 업무 보드 #40 과 같은 fallback 패턴.
  const [page, meResult] = await Promise.all([
    listVotesInRoom(roomId),
    (async (): Promise<number | null> => {
      try {
        const me = await getMyAccount();
        return me.id;
      } catch (e) {
        console.error("RoomVotesPage getMyAccount failed:", e);
        return null;
      }
    })(),
  ]);

  // ⚠️ 상세 요청 하나가 실패해도 **나머지 투표는 그대로 노출**되어야 한다. `Promise.all`
  //    로 묶으면 1건 실패에 전체 페이지가 500 으로 떨어져 사용자가 모든 투표를 못 본다
  //    (CodeRabbit). 개별 settle 후 성공한 것만 details map 에 넣는다.
  const detailResults = await Promise.allSettled(
    page.content.map((s) => getVoteDetail(roomId, s.voteId)),
  );
  const details: Record<number, VoteDetail> = {};
  detailResults.forEach((res, i) => {
    const summary = page.content[i];
    if (!summary) return;
    if (res.status === "fulfilled" && res.value) {
      details[summary.voteId] = res.value;
    } else if (res.status === "rejected") {
      console.error(
        `RoomVotesPage detail fetch failed for voteId=${summary.voteId}:`,
        res.reason,
      );
    }
  });

  return (
    <>
    <BriefingFocus ids={readBriefingFocus(briefingFocus)} />
    <VotesPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={page.content}
      details={details}
      meAccountId={meResult}
      initialOpenVoteId={openVoteId}
      sourceCard={sourceCard}
    />
    </>
  );
}
