import type { WidgetType } from "@/types/db";

export const DEFAULT_WIDGET_LAYOUT = [
  { widgetType: "MOOD", x: 0, y: 0, width: 3, height: 4 },
  { widgetType: "IDEA_BOARD", x: 3, y: 0, width: 6, height: 7 },
  { widgetType: "CATCHUP_BRIEFING", x: 9, y: 0, width: 3, height: 7 },
  { widgetType: "TASK_BOARD", x: 3, y: 7, width: 6, height: 4 },
] as const satisfies readonly { widgetType: WidgetType; x: number; y: number; width: number; height: number }[];
