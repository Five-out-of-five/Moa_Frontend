"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

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

const ARROW_OFFSETS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
} as const;

function adjustPlacement(widget: RoomWidget, kind: Gesture["kind"], dx: number, dy: number) {
  if (kind === "move") {
    return {
      x: clamp(widget.x + dx, 0, GRID_COLUMNS - widget.width),
      y: Math.max(0, widget.y + dy),
      width: widget.width,
      height: widget.height,
    };
  }
  const [minWidth, minHeight] = WIDGET_MINIMUM[widget.widgetType];
  return {
    x: widget.x,
    y: widget.y,
    width: clamp(widget.width + dx, minWidth, GRID_COLUMNS - widget.x),
    height: clamp(widget.height + dy, minHeight, GRID_MAX_HEIGHT),
  };
}

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
    onEdit(widget.id);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const { widget, kind, startX, startY, columnStep } = gesture;
    const dx = Math.round((event.clientX - startX) / columnStep);
    const dy = Math.round((event.clientY - startY) / (GRID_ROW_HEIGHT + GRID_GAP));
    const placement = adjustPlacement(widget, kind, dx, dy);
    if (!canPlaceWidget(widget, placement, widgets)) return;
    gesture.placement = placement;
    setPreview({ id: widget.id, placement });
  }

  function end(event: PointerEvent<HTMLButtonElement>, shouldSave: boolean) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    active.current = null;
    setPreview(null);
    onEdit(null);
    const { widget, placement } = gesture;
    if (shouldSave) savePlacement(widget, placement);
  }

  function savePlacement(widget: RoomWidget, placement: WidgetPlacement) {
    if (
      (placement.x !== widget.x || placement.y !== widget.y ||
        placement.width !== widget.width || placement.height !== widget.height) &&
      canPlaceWidget(widget, placement, widgets)
    ) {
      onSave(widget.id, placement);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, widget: RoomWidget, kind: Gesture["kind"]) {
    if (!Object.hasOwn(ARROW_OFFSETS, event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (active.current || event.repeat) return;
    const [dx, dy] = ARROW_OFFSETS[event.key as keyof typeof ARROW_OFFSETS];
    savePlacement(widget, adjustPlacement(widget, kind, dx, dy));
  }

  return { grid, preview, start, move, end, keyDown };
}
