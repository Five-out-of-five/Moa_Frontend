import { notFound } from "next/navigation";

import { getMyAccount } from "@/features/account/server";
import { listMyRooms, listRoomMembers } from "@/features/room/server";
import { TaskBoardPageClient } from "@/features/task/components/TaskBoardPageClient";
import {
  getActiveSprint,
  getTaskDetail,
  listTasksInRoom,
} from "@/features/task/server";
import type { MemberRef, Sprint, TaskDetail } from "@/types/db";

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

  // 생성 다이얼로그가 쓰는 담당자 목록·내 계정은 Server Component 에서 선패치해
  // Client 에 prop 으로만 전달한다 (컴포넌트는 isMock 을 모름).
  //
  // ⚠️ 멤버/내 계정 조회가 실패해도 **보드 자체는 열려야** 한다 — 상세 fetch 를
  //    Promise.allSettled 로 돌리는 것과 같은 이유. 실패 시 빈 리스트 / null 로 fallback
  //    하고, 생성 다이얼로그는 "담당자 선택 불가" 상태로 자연스럽게 떨어진다.
  const [summaries, membersResult, meResult, activeSprintResult] =
    await Promise.all([
      listTasksInRoom(roomId),
      (async (): Promise<MemberRef[]> => {
        try {
          return await listRoomMembers(roomId);
        } catch (e) {
          console.error(`RoomTaskBoardPage listRoomMembers failed (roomId=${roomId}):`, e);
          return [];
        }
      })(),
      (async (): Promise<number | null> => {
        try {
          const me = await getMyAccount();
          return me.id;
        } catch (e) {
          console.error("RoomTaskBoardPage getMyAccount failed:", e);
          return null;
        }
      })(),
      (async (): Promise<Sprint | null> => {
        try {
          return await getActiveSprint(roomId);
        } catch (e) {
          console.error(`RoomTaskBoardPage getActiveSprint failed (roomId=${roomId}):`, e);
          return null;
        }
      })(),
    ]);

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
      members={membersResult}
      meAccountId={meResult}
      activeSprint={activeSprintResult}
      initialOpenTaskId={openTaskId}
      unavailableTaskIds={unavailableTaskIds}
    />
  );
}
