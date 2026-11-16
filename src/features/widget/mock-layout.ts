import "server-only";

import { roomWidgets } from "@/mocks/db";

import type { DashboardSnapshot } from "./live-types";

const EDIT_TIMEOUT_MS = 10_000;
type Editing = { widgetId: number; sessionId: string; expiresAt: number };
type RoomLayout = { revision: number; editors: Map<string, Editing> };
const runtime = globalThis as typeof globalThis & {
  moaDashboardLayouts?: Map<number, RoomLayout>;
};
const layouts = (runtime.moaDashboardLayouts ??= new Map());

export function getMockLayout(roomId: number) {
  let layout = layouts.get(roomId);
  if (!layout) {
    layout = { revision: 0, editors: new Map() };
    layouts.set(roomId, layout);
  }
  return layout;
}

export function setMockEditing(
  roomId: number,
  accountId: number,
  sessionId: string,
  widgetId: number | null,
) {
  const { editors } = getMockLayout(roomId);
  const key = `${accountId}:${sessionId}`;
  if (widgetId === null) editors.delete(key);
  else editors.set(key, { widgetId, sessionId, expiresAt: Date.now() + EDIT_TIMEOUT_MS });
}

export function getMockDashboardSnapshot(roomId: number): DashboardSnapshot {
  const { revision, editors } = getMockLayout(roomId);
  const now = Date.now();
  for (const [key, editor] of editors) {
    if (editor.expiresAt <= now) editors.delete(key);
  }
  return {
    revision,
    widgets: roomWidgets.filter((widget) => widget.roomId === roomId).map((widget) => ({ ...widget })),
    editors: Array.from(editors.values(), ({ widgetId, sessionId }) => ({ widgetId, sessionId })),
  };
}
