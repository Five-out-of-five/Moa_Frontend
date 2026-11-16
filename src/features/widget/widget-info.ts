import type { WidgetType } from "@/types/db";

export const WIDGET_TITLES: Record<WidgetType, string> = {
  MOOD: "팀 상태",
  IDEA_BOARD: "아이디어 보드",
  TASK_BOARD: "업무 보드",
  PROGRESS: "진척도",
  VOTE: "투표",
  CATCHUP_BRIEFING: "캐치업 브리핑",
  MEDIATION: "AI 중재",
};

export function getWidgetDetailHref(roomId: number, type: WidgetType) {
  if (type === "TASK_BOARD" || type === "PROGRESS") return `/rooms/${roomId}/boards/task`;
  if (type === "VOTE") return `/rooms/${roomId}/votes`;
}
