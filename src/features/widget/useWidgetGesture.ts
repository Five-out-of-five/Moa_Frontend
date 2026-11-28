"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

import type { RoomWidget } from "@/types/db";

import {
  areWidgetPlacementsValid,
  getWidgetMove,
  GRID_COLUMNS,
  GRID_GAP,
  GRID_MAX_HEIGHT,
  GRID_ROW_HEIGHT,
  WIDGET_MINIMUM,
  type WidgetPlacementChange,
} from "./grid";

type Gesture = {
  widget: RoomWidget;
  kind: "move" | "resize";
  pointer: number;
  startX: number;
  startY: number;
  columnStep: number;
  changes: WidgetPlacementChange[];
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
  onSave: (changes: WidgetPlacementChange[]) => Promise<void>,
) {
  const grid = useRef<HTMLDivElement>(null);
  const active = useRef<Gesture | null>(null);
  const saving = useRef(false);
  const [preview, setPreview] = useState<WidgetPlacementChange[] | null>(null);

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
      changes: [],
    };
    setPreview([]);
    onEdit(widget.id);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const { widget, kind, startX, startY, columnStep } = gesture;
    const dx = Math.round((event.clientX - startX) / columnStep);
    const dy = Math.round((event.clientY - startY) / (GRID_ROW_HEIGHT + GRID_GAP));
    const placement = adjustPlacement(widget, kind, dx, dy);
    const changes = kind === "move"
      ? getWidgetMove(widget, placement, widgets)
      : [{ widgetId: widget.id, ...placement }];
    if (!changes || (kind === "resize" && !areWidgetPlacementsValid(widgets, changes))) return;
    gesture.changes = changes;
    setPreview(changes);
  }

  function end(event: PointerEvent<HTMLButtonElement>, shouldSave: boolean) {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    active.current = null;
    setPreview(null);
    if (shouldSave) void savePlacement(gesture.widget.id, gesture.changes, true);
    else onEdit(null);
  }

  async function savePlacement(widgetId: number, changes: WidgetPlacementChange[], editing = false) {
    const changed = changes.some(({ widgetId, x, y, width, height }) => {
      const widget = widgets.find(({ id }) => id === widgetId);
      return widget && (x !== widget.x || y !== widget.y || width !== widget.width || height !== widget.height);
    });
    if (!changed || !areWidgetPlacementsValid(widgets, changes)) {
      if (editing) onEdit(null);
      return;
    }
    saving.current = true;
    try {
      if (!editing) onEdit(widgetId);
      await onSave(changes);
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
    void savePlacement(widget.id, [{ widgetId: widget.id, ...adjustPlacement(widget, kind, dx, dy) }]);
  }

  return { grid, preview, start, move, end, keyDown };
}
