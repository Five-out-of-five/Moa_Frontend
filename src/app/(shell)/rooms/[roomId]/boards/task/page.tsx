import { notFound } from "next/navigation";

import { listMyRooms } from "@/features/room/server";
import { TaskBoardPageClient } from "@/features/task/components/TaskBoardPageClient";
import { getTaskDetail, listTasksInRoom } from "@/features/task/server";
import type { TaskDetail } from "@/types/db";

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ open?: string | string[] }>;
}

/**
 * 방 업무 보드 전체 보기 — 명세 10/28 `Task` 도메인 조회 + 상태 변경.
 *
 * ⚠️ Summary + Detail 을 **page 에서 함께 선패치**해 client 로 넘긴다. 업무가 많아질 때
 *    비효율이 보이면 상세만 lazy fetch 로 분리.
 */
export default async function RoomTaskBoardPage({
  params,
  searchParams,
}: Props) {
  const { roomId: roomIdParam } = await params;
  const { open: openRaw } = await searchParams;
  const roomId = Number(roomIdParam);
  if (!Number.isFinite(roomId)) notFound();

  // 알림 등에서 `?open={taskId}` 로 들어오면 그 업무의 Sheet 를 바로 연다.
  const openParam = Array.isArray(openRaw) ? openRaw[0] : openRaw;
  const openTaskId =
    openParam && Number.isFinite(Number(openParam))
      ? Number(openParam)
      : null;

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
  const unavailableTaskIds: number[] = [];
  detailResults.forEach((res, i) => {
    const summary = summaries[i];
    if (!summary) return;
    if (res.status === "fulfilled" && res.value) {
      details[summary.taskId] = res.value;
    } else {
      // reject 든 null(그 사이 삭제) 이든 **상세 미확보** 상태 — 카드에 "불러오기 실패" 로 표시.
      if (res.status === "rejected") {
        console.error(
          `RoomTaskBoardPage detail fetch failed for taskId=${summary.taskId}:`,
          res.reason,
        );
      }
      unavailableTaskIds.push(summary.taskId);
    }
  });

  return (
    <TaskBoardPageClient
      roomId={roomId}
      roomName={room.name}
      summaries={summaries}
      details={details}
      initialOpenTaskId={openTaskId}
      unavailableTaskIds={unavailableTaskIds}
    />
  );
}
