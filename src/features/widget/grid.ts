import type { RoomWidget, WidgetType } from "@/types/db";

export const GRID_COLUMNS = 12;
export const GRID_ROW_HEIGHT = 60;
export const GRID_GAP = 12;
export const GRID_MAX_HEIGHT = 8;

export type WidgetPlacement = Pick<RoomWidget, "x" | "y" | "width" | "height">;

export const WIDGET_MINIMUM = {
  MOOD: [3, 3],
  IDEA_BOARD: [6, 5],
  TASK_BOARD: [4, 4],
  PROGRESS: [2, 2],
  VOTE: [3, 3],
  CATCHUP_BRIEFING: [3, 3],
  MEDIATION: [3, 3],
} as const satisfies Record<WidgetType, readonly [number, number]>;

export function canPlaceWidget(
  widget: RoomWidget,
  next: WidgetPlacement,
  widgets: RoomWidget[],
) {
  const { x, y, width, height } = next;
  const [minWidth, minHeight] = WIDGET_MINIMUM[widget.widgetType];
  return (
    [x, y, width, height, y + height].every(Number.isSafeInteger) &&
    x >= 0 && y >= 0 &&
    width >= minWidth && x + width <= GRID_COLUMNS &&
    height >= minHeight && height <= GRID_MAX_HEIGHT &&
    !widgets.some((other) =>
      other.id !== widget.id &&
      x < other.x + other.width && other.x < x + width &&
      y < other.y + other.height && other.y < y + height,
    )
  );
}
