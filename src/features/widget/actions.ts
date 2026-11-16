"use server";

import { revalidatePath } from "next/cache";

import { getManagedRoom } from "@/features/room/management/server";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";

import { canPlaceWidget, type WidgetPlacement } from "./grid";
import { getMockDashboardSnapshot, getMockLayout, setMockEditing } from "./mock-layout";

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
