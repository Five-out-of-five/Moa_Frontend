"use client";

import { type PointerEvent, useRef, useState } from "react";

import type { RoomWidget } from "@/types/db";

import {
  canPlaceWidget,
  GRID_COLUMNS,
  GRID_GAP,
  GRID_MAX_HEIGHT,
  GRID_ROW_HEIGHT,
  WIDGET_MINIMUM,
  type WidgetPlacement,
} from "./grid";

type Gesture = {
  widget: RoomWidget;
  kind: "move" | "resize";
  pointer: number;
  startX: number;
  startY: number;
  columnStep: number;
  placement: WidgetPlacement;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useWidgetGesture(
  widgets: RoomWidget[],
  onEdit: (widgetId: number | null) => void,
  onSave: (id: number, next: WidgetPlacement) => void,
) {
  const grid = useRef<HTMLDivElement>(null);
  const active = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ id: number; placement: WidgetPlacement } | null>(null);

  function start(event: PointerEvent<HTMLButtonElement>, widget: RoomWidget, kind: Gesture["kind"]) {
    if (!grid.current || active.current || event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = {
      widget,
      kind,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      columnStep: (grid.current.clientWidth + GRID_GAP) / GRID_COLUMNS,
      placement: widget,
    };
    setPreview({ id: widget.id, placement: widget });
    if (kind === "move") onEdit(widget.id);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const { widget, kind, startX, startY, columnStep } = gesture;
    const dx = Math.round((event.clientX - startX) / columnStep);
    const dy = Math.round((event.clientY - startY) / (GRID_ROW_HEIGHT + GRID_GAP));
    const [minWidth, minHeight] = WIDGET_MINIMUM[widget.widgetType];
    const placement = kind === "move"
      ? {
          x: clamp(widget.x + dx, 0, GRID_COLUMNS - widget.width),
          y: Math.max(0, widget.y + dy),
          width: widget.width,
          height: widget.height,
        }
      : {
          x: widget.x,
          y: widget.y,
          width: clamp(widget.width + dx, minWidth, GRID_COLUMNS - widget.x),
          height: clamp(widget.height + dy, minHeight, GRID_MAX_HEIGHT),
        };
    if (!canPlaceWidget(widget, placement, widgets)) return;
    gesture.placement = placement;
    setPreview({ id: widget.id, placement });
  }

  function end(event: PointerEvent<HTMLButtonElement>, shouldSave: boolean) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    active.current = null;
    setPreview(null);
    if (gesture.kind === "move") onEdit(null);
    const { widget, placement } = gesture;
    if (shouldSave && placement !== widget &&
      (placement.x !== widget.x || placement.y !== widget.y ||
        placement.width !== widget.width || placement.height !== widget.height)) {
      onSave(widget.id, placement);
    }
  }

  return { grid, preview, start, move, end };
}
