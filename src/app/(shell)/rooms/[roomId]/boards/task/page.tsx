import { notFound } from "next/navigation";

import { listMyRooms } from "@/features/room/server";
import { TaskBoardPageClient } from "@/features/task/components/TaskBoardPageClient";
import { getTaskDetail, listTasksInRoom } from "@/features/task/server";
import type { TaskDetail } from "@/types/db";

interface Props {
  params: Promise<{ roomId: string }>;
}

/**
 * 방 업무 보드 전체 보기 — 명세 10/28 `Task` 도메인 조회 + 상태 변경.
 *
 * ⚠️ Summary + Detail 을 **page 에서 함께 선패치**해 client 로 넘긴다. 업무가 많아질 때
 *    비효율이 보이면 상세만 lazy fetch 로 분리.
 */
export default async function RoomTaskBoardPage({ params }: Props) {
  const { roomId: roomIdParam } = await params;
  const roomId = Number(roomIdParam);
  if (!Number.isFinite(roomId)) notFound();

  const rooms = await listMyRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  const summaries = await listTasksInRoom(roomId);
  const detailEntries = await Promise.all(
    summaries.map(async (s) => {
      const d = await getTaskDetail(roomId, s.taskId);
      return d ? ([s.taskId, d] as const) : null;
    }),
  );
  const details: Record<number, TaskDetail> = Object.fromEntries(
    detailEntries.filter(
      (entry): entry is readonly [number, TaskDetail] => entry !== null,
    ),
  );

  return (
    <TaskBoardPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={summaries}
      details={details}
    />
  );
}
