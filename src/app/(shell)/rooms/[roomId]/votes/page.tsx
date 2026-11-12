import { notFound } from "next/navigation";

import { listMyRooms } from "@/features/room/server";
import { VotesPageClient } from "@/features/vote/components/VotesPageClient";
import { getVoteDetail, listVotesInRoom } from "@/features/vote/server";
import type { VoteDetail } from "@/types/db";

interface Props {
  params: Promise<{ roomId: string }>;
}

/**
 * 방 안의 투표 전체 보기 — 명세 10/28 `Vote` 도메인.
 *
 * ⚠️ 상세는 **page 에서 미리 함께 fetch** 해 client 에 넘긴다. 목록이 보통 10~20개 단위라
 *    Sheet 열 때마다 왕복하지 않아도 되고, 목에서는 서버 왕복 자체가 없다. 실서버로 전환
 *    했을 때 비용이 커지면 `getVoteDetailAction` 으로 lazy 전환하면 된다.
 */
export default async function RoomVotesPage({ params }: Props) {
  const { roomId: roomIdParam } = await params;
  const roomId = Number(roomIdParam);
  if (!Number.isFinite(roomId)) notFound();

  // listMyRooms 는 사이드바·헤더 작업에서 이미 공용으로 쓰이는 조회 — 방 이름만 뽑아 쓴다.
  const rooms = await listMyRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  const page = await listVotesInRoom(roomId);

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
    <VotesPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={page.content}
      details={details}
    />
  );
}
