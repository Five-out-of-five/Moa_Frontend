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
  const detailEntries = await Promise.all(
    page.content.map(async (s) => {
      const d = await getVoteDetail(roomId, s.voteId);
      return d ? ([s.voteId, d] as const) : null;
    }),
  );
  const details: Record<number, VoteDetail> = Object.fromEntries(
    detailEntries.filter(
      (entry): entry is readonly [number, VoteDetail] => entry !== null,
    ),
  );

  return (
    <VotesPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={page.content}
      details={details}
    />
  );
}
