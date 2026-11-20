"use server";

import { revalidatePath } from "next/cache";

import { markIdeaChanged } from "@/features/idea/mock-board";
import { getManagedRoom } from "@/features/room/management/server";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";
import type { WidgetType } from "@/types/db";

import { DEFAULT_WIDGET_LAYOUT } from "./default-layout";
import { canPlaceWidget, findOpenPlacement, WIDGET_MINIMUM, type WidgetPlacement } from "./grid";
import { getMockDashboardSnapshot, getMockLayout, setMockEditing } from "./mock-layout";

export async function addWidgetAction(roomId: number, type: WidgetType) {
  if (!isMock || !(await getManagedRoom(roomId))) {
    return { ok: false as const, message: "이 대시보드에 위젯을 추가할 수 없습니다." };
  }
  if (typeof type !== "string" || !Object.hasOwn(WIDGET_MINIMUM, type)) {
    return { ok: false as const, message: "추가할 수 있는 위젯을 선택해 주세요." };
  }
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  if (widgets.some((widget) => widget.widgetType === type)) {
    return { ok: false as const, message: "이미 추가된 위젯입니다." };
  }

  const [width, height] = WIDGET_MINIMUM[type];
  const placement = findOpenPlacement(widgets, width, height);
  const id = roomWidgets.reduce((max, widget) => Math.max(max, widget.id), 0) + 1;
  roomWidgets.push({ id, roomId, widgetType: type, ...placement });
  if (type === "MEDIATION") markIdeaChanged(roomId);
  getMockLayout(roomId).revision += 1;
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true as const, snapshot: getMockDashboardSnapshot(roomId) };
}

export async function saveWidgetPlacementAction(
  roomId: number,
  widgetId: number,
  placement: WidgetPlacement,
) {
  if (!isMock || !(await getManagedRoom(roomId))) {
    return { ok: false as const, message: "이 대시보드의 배치를 저장할 수 없습니다." };
  }
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  const widget = widgets.find(({ id }) => id === widgetId);
  if (!widget || !placement || !canPlaceWidget(widget, placement, widgets)) {
    return { ok: false as const, message: "배치를 저장할 수 없습니다. 위젯 위치와 크기를 확인해 주세요." };
  }
  const { x, y, width, height } = placement;
  Object.assign(widget, { x, y, width, height });
  getMockLayout(roomId).revision += 1;
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true as const, snapshot: getMockDashboardSnapshot(roomId) };
}

export async function setWidgetEditingAction(
  roomId: number,
  widgetId: number | null,
  sessionId: string,
) {
  if (!isMock || typeof sessionId !== "string" || !/^[a-f\d-]{36}$/i.test(sessionId)) return;
  const room = await getManagedRoom(roomId);
  if (!room) return;
  if (widgetId !== null && !roomWidgets.some(({ id, roomId: idOfRoom }) =>
    id === widgetId && idOfRoom === roomId,
  )) return;
  setMockEditing(roomId, room.account.id, sessionId, widgetId);
}

export async function removeWidgetAction(roomId: number, widgetId: number) {
  if (!isMock || !(await getManagedRoom(roomId))) {
    return { ok: false as const, message: "이 방의 위젯을 삭제할 수 없어요." };
  }
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  const index = roomWidgets.findIndex((widget) => widget.roomId === roomId && widget.id === widgetId);
  if (index < 0) return { ok: false as const, message: "이미 삭제된 위젯이에요." };
  if (widgets.length <= 1) return { ok: false as const, message: "위젯은 최소 1개를 유지해야 해요." };
  const [removed] = roomWidgets.splice(index, 1);
  if (removed.widgetType === "MEDIATION") markIdeaChanged(roomId);
  const layout = getMockLayout(roomId);
  for (const [key, editor] of layout.editors) if (editor.widgetId === widgetId) layout.editors.delete(key);
  layout.revision += 1;
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/mediation`);
  revalidatePath(`/rooms/${roomId}/boards/idea`);
  return { ok: true as const, snapshot: getMockDashboardSnapshot(roomId) };
}

export async function resetWidgetLayoutAction(roomId: number) {
  if (!isMock || !(await getManagedRoom(roomId))) {
    return { ok: false as const, message: "이 방의 배치를 초기화할 수 없어요." };
  }
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  let id = roomWidgets.reduce((max, widget) => Math.max(max, widget.id), 0);
  const defaults = DEFAULT_WIDGET_LAYOUT.map((preset) => ({
    ...preset, roomId,
    id: widgets.find(({ widgetType }) => widgetType === preset.widgetType)?.id ?? ++id,
  }));
  for (let index = roomWidgets.length - 1; index >= 0; index--) {
    if (roomWidgets[index].roomId === roomId) roomWidgets.splice(index, 1);
  }
  roomWidgets.push(...defaults);
  markIdeaChanged(roomId);
  const layout = getMockLayout(roomId);
  layout.editors.clear();
  layout.revision += 1;
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/mediation`);
  revalidatePath(`/rooms/${roomId}/boards/idea`);
  return { ok: true as const, snapshot: getMockDashboardSnapshot(roomId) };
}
