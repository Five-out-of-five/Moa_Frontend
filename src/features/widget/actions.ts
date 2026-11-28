"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { markIdeaChanged } from "@/features/idea/mock-board";
import { isRoomId } from "@/features/room/management/api-server";
import { getManagedRoom } from "@/features/room/management/server";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";
import type { WidgetType } from "@/types/db";

import { changeApiLayout, type LayoutResult } from "./api-layout";
import { DEFAULT_WIDGET_LAYOUT } from "./default-layout";
import { areWidgetPlacementsValid, findOpenPlacement, WIDGET_MINIMUM, type WidgetPlacementChange } from "./grid";
import { getMockDashboardSnapshot, getMockLayout, setMockEditing } from "./mock-layout";
import { getDashboardSnapshot } from "./server";

const placementChangesSchema = z.array(z.object({
  widgetId: z.number().refine(isRoomId),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})).min(1).max(Object.keys(WIDGET_MINIMUM).length).refine(
  (changes) => new Set(changes.map(({ widgetId }) => widgetId)).size === changes.length,
);

export async function addWidgetAction(roomId: number, type: WidgetType): Promise<LayoutResult> {
  if (!isRoomId(roomId) || (isMock && !(await getManagedRoom(roomId)))) {
    return { ok: false as const, message: "이 대시보드에 위젯을 추가할 수 없습니다." };
  }
  if (typeof type !== "string" || !Object.hasOwn(WIDGET_MINIMUM, type)) {
    return { ok: false as const, message: "추가할 수 있는 위젯을 선택해 주세요." };
  }
  const [width, height] = WIDGET_MINIMUM[type];
  if (!isMock) return changeApiLayout(roomId, async () => {
    const { widgets } = await getDashboardSnapshot(roomId);
    const { x, y } = findOpenPlacement(widgets, width, height);
    return {
      path: "widgets",
      init: { method: "POST", json: { widgetType: type, x, y, w: width, h: height } },
      shouldRefreshMediation: type === "MEDIATION",
    };
  });
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  if (widgets.some((widget) => widget.widgetType === type)) {
    return { ok: false as const, message: "이미 추가된 위젯입니다." };
  }

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
  changes: WidgetPlacementChange[],
): Promise<LayoutResult> {
  if (!isRoomId(roomId) || (isMock && !(await getManagedRoom(roomId)))) {
    return { ok: false as const, message: "이 대시보드의 배치를 저장할 수 없습니다." };
  }
  const parsed = placementChangesSchema.safeParse(changes);
  if (!parsed.success) return { ok: false, message: "위젯 위치와 크기를 확인해 주세요." };
  if (!isMock) return changeApiLayout(roomId, () => ({
    path: "layout",
    init: {
      method: "PUT",
      json: { widgets: parsed.data.map(({ widgetId, x, y, width, height }) => ({
        widgetId, x, y, w: width, h: height,
      })) },
    },
  }));
  const widgets = roomWidgets.filter((widget) => widget.roomId === roomId);
  if (!areWidgetPlacementsValid(widgets, parsed.data)) {
    return { ok: false as const, message: "배치를 저장할 수 없습니다. 위젯 위치와 크기를 확인해 주세요." };
  }
  const placements = new Map(parsed.data.map(({ widgetId, ...placement }) => [widgetId, placement]));
  for (const widget of widgets) {
    const placement = placements.get(widget.id);
    if (placement) Object.assign(widget, placement);
  }
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

export async function removeWidgetAction(roomId: number, widgetId: number): Promise<LayoutResult> {
  if (!isRoomId(roomId) || !isRoomId(widgetId) || (isMock && !(await getManagedRoom(roomId)))) {
    return { ok: false as const, message: "이 방의 위젯을 삭제할 수 없어요." };
  }
  if (!isMock) return changeApiLayout(roomId, () => ({
    path: `widgets/${widgetId}`,
    init: { method: "DELETE" },
    shouldRefreshMediation: true,
  }));
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

export async function resetWidgetLayoutAction(roomId: number): Promise<LayoutResult> {
  if (!isRoomId(roomId) || (isMock && !(await getManagedRoom(roomId)))) {
    return { ok: false as const, message: "이 방의 배치를 초기화할 수 없어요." };
  }
  if (!isMock) return changeApiLayout(roomId, () => ({
    path: "reset",
    init: { method: "POST" },
    shouldRefreshMediation: true,
  }));
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
