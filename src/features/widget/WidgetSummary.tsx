import { listBoardEvents } from "@/features/briefing/server";
import { listIdeaCards } from "@/features/idea/server";
import { listConflicts } from "@/features/mediation/server";
import { listTodayMoods } from "@/features/mood/server";
import { listTasksInRoom } from "@/features/task/server";
import { listVotesInRoom } from "@/features/vote/server";
import type { RoomWidget } from "@/types/db";

import { WIDGET_TITLES } from "./widget-info";

async function readSummary({ roomId, widgetType }: RoomWidget) {
  switch (widgetType) {
    case "MOOD":
      return { count: (await listTodayMoods(roomId)).length, label: "오늘 기록된 상태" };
    case "IDEA_BOARD":
      return { count: (await listIdeaCards(roomId)).length, label: "아이디어 카드" };
    case "TASK_BOARD":
      return { count: (await listTasksInRoom(roomId)).length, label: "업무" };
    case "PROGRESS": {
      const tasks = await listTasksInRoom(roomId);
      return { count: tasks.length, label: "업무" };
    }
    case "VOTE":
      return { count: (await listVotesInRoom(roomId)).totalElements, label: "투표" };
    case "CATCHUP_BRIEFING":
      return { count: (await listBoardEvents(roomId)).length, label: "기록된 변경" };
    case "MEDIATION":
      return { count: (await listConflicts(roomId)).length, label: "감지된 충돌" };
  }
}

export function WidgetLoading() {
  return (
    <div role="status" className="animate-pulse space-y-3">
      <span className="sr-only">위젯 데이터를 불러오는 중</span>
      <div className="bg-muted h-6 w-1/3 rounded" />
      <div className="bg-muted h-3 w-2/3 rounded" />
    </div>
  );
}

export async function WidgetSummary({ widget }: { widget: RoomWidget }) {
  try {
    const { count, label } = await readSummary(widget);
    if (!count) return <p className="text-muted-foreground text-sm">표시할 항목이 없습니다.</p>;
    return (
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{count}건</p>
      </div>
    );
  } catch {
    return (
      <p role="alert" className="text-destructive text-sm">
        {WIDGET_TITLES[widget.widgetType]} 데이터를 불러오지 못했습니다.
      </p>
    );
  }
}
