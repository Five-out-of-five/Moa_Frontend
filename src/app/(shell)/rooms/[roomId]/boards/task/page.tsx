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

  // ⚠️ 상세 1건이 실패해도(예: 그 사이 삭제된 업무) **나머지 업무는 그대로 노출** 되어야
  //    한다. Promise.all 로 묶으면 1건 실패에 전체 보드가 500 으로 떨어진다 (CodeRabbit).
  const detailResults = await Promise.allSettled(
    summaries.map((s) => getTaskDetail(roomId, s.taskId)),
  );
  const details: Record<number, TaskDetail> = {};
  detailResults.forEach((res, i) => {
    const summary = summaries[i];
    if (!summary) return;
    if (res.status === "fulfilled" && res.value) {
      details[summary.taskId] = res.value;
    } else if (res.status === "rejected") {
      console.error(
        `RoomTaskBoardPage detail fetch failed for taskId=${summary.taskId}:`,
        res.reason,
      );
    }
  });

  return (
    <TaskBoardPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={summaries}
      details={details}
    />
  );
}
