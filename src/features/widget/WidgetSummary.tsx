import type { RoomWidget } from "@/types/db";

import { BriefingSummary } from "./BriefingSummary";
import { MediationSummary, VoteSummary } from "./DecisionSummaries";
import { IdeaSummary } from "./IdeaSummary";
import { MoodSummary } from "./MoodSummary";
import { SprintSummary, TaskBoardSummary } from "./TaskSummaries";
import { WIDGET_TITLES } from "./widget-info";

const renderSummary = {
  MOOD: MoodSummary,
  IDEA_BOARD: IdeaSummary,
  TASK_BOARD: TaskBoardSummary,
  PROGRESS: SprintSummary,
  VOTE: VoteSummary,
  CATCHUP_BRIEFING: BriefingSummary,
  MEDIATION: MediationSummary,
};

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
    return await renderSummary[widget.widgetType]({ roomId: widget.roomId });
  } catch {
    return (
      <p role="alert" className="text-destructive text-sm">
        {WIDGET_TITLES[widget.widgetType]} 데이터를 불러오지 못했습니다.
      </p>
    );
  }
}
