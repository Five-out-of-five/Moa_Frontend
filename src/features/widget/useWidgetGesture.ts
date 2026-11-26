"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

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
  onSave: (id: number, next: WidgetPlacement) => Promise<void>,
) {
  const grid = useRef<HTMLDivElement>(null);
  const active = useRef<Gesture | null>(null);
  const saving = useRef(false);
  const [preview, setPreview] = useState<{ id: number; placement: WidgetPlacement } | null>(null);

  useEffect(() => {
    const gesture = active.current;
    if (gesture && !widgets.some(({ id }) => id === gesture.widget.id)) {
      active.current = null;
      setPreview(null);
      onEdit(null);
    }
  }, [onEdit, widgets]);

  function start(event: PointerEvent<HTMLButtonElement>, widget: RoomWidget, kind: Gesture["kind"]) {
    if (!grid.current || active.current || saving.current || event.button !== 0 || !event.isPrimary) return;
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
    const { widget, placement } = gesture;
    if (shouldSave) void savePlacement(widget, placement, true);
    else onEdit(null);
  }

  async function savePlacement(widget: RoomWidget, placement: WidgetPlacement, editing = false) {
    const changed = placement.x !== widget.x || placement.y !== widget.y ||
      placement.width !== widget.width || placement.height !== widget.height;
    if (!changed || !canPlaceWidget(widget, placement, widgets)) {
      if (editing) onEdit(null);
      return;
    }
    saving.current = true;
    try {
      if (!editing) onEdit(widget.id);
      await onSave(widget.id, placement);
    } finally {
      saving.current = false;
      onEdit(null);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, widget: RoomWidget, kind: Gesture["kind"]) {
    if (!Object.hasOwn(ARROW_OFFSETS, event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (active.current || saving.current || event.repeat) return;
    const [dx, dy] = ARROW_OFFSETS[event.key as keyof typeof ARROW_OFFSETS];
    void savePlacement(widget, adjustPlacement(widget, kind, dx, dy));
  }

  return { grid, preview, start, move, end, keyDown };
}
