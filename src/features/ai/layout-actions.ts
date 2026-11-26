"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canPlaceWidget, findOpenPlacement, WIDGET_MINIMUM } from "@/features/widget/grid";
import type { DashboardSnapshot } from "@/features/widget/live-types";
import { getMockDashboardSnapshot, getMockLayout } from "@/features/widget/mock-layout";
import { toDashboardSnapshot } from "@/features/widget/snapshot";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";
import type { RoomWidget, WidgetType } from "@/types/db";

import { aiFailure } from "./action-error";
import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext } from "./server";
import type { AiResult, LayoutProposal, RecommendedWidget } from "./types";

const placements = z.array(z.object({
  widgetType: z.custom<WidgetType>((value) => typeof value === "string" && Object.hasOwn(WIDGET_MINIMUM, value)),
  x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
  w: z.number().int().positive(), h: z.number().int().positive(),
})).max(7);
const recommendation = z.object({ widgets: placements, reason: z.string() });

function layoutPath(roomId: number) {
  if (!Number.isSafeInteger(roomId) || roomId < 1) throw new Error("방 정보가 올바르지 않아요.");
  return `/api/v1/rooms/${roomId}/dashboard/ai-recommendations`;
}

function saved(roomId: number, data: DashboardSnapshot) {
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true as const, data };
}

export async function recommendLayout(roomId: number, purpose: string): Promise<AiResult<LayoutProposal>> {
  try {
    const path = layoutPath(roomId);
    if (typeof purpose !== "string" || !purpose.trim() || purpose.length > 200) throw new Error("목적을 1~200자로 입력해 주세요.");
    if (!isMock) {
      const data = recommendation.safeParse(await api(path, { method: "POST", json: { purpose: purpose.trim() }, timeoutMs: 35_000, cache: "no-store" }));
      if (!data.success) throw new Error("추천 배치를 확인할 수 없어요.");
      return { ok: true, data: data.data };
    }
    const context = await getAiContext(roomId);
    const current = roomWidgets.filter((widget) => widget.roomId === roomId);
    if (!current.length) throw new Error("대시보드에 위젯을 먼저 추가해 주세요.");
    takeAiCall(roomId, "LAYOUT");
    const order = /회고|아이디어/.test(purpose) ? ["IDEA_BOARD", "MOOD", "CATCHUP_BRIEFING"] : ["TASK_BOARD", "PROGRESS", "CATCHUP_BRIEFING"];
    const sorted = [...current].sort((a, b) => {
      const rank = (type: string) => order.includes(type) ? order.indexOf(type) : order.length;
      return rank(a.widgetType) - rank(b.widgetType) || a.id - b.id;
    });
    const widgets: RoomWidget[] = [];
    for (const widget of sorted) {
      const [minW, minH] = WIDGET_MINIMUM[widget.widgetType];
      const placement = findOpenPlacement(widgets, Math.max(minW, widget.width), Math.max(minH, widget.height));
      widgets.push({ ...widget, ...placement });
    }
    const proposal = { id: randomUUID(), widgets, revision: getMockLayout(roomId).revision };
    const reason = /회고|아이디어/.test(purpose)
      ? "아이디어와 팀 상태를 먼저 확인할 수 있도록 배치했어요."
      : "업무와 진행 상황을 먼저 확인할 수 있도록 배치했어요.";
    aiMock.proposals.set(context.key, proposal);
    return { ok: true, data: { mockId: proposal.id, reason, widgets: widgets.map(({ widgetType, x, y, width, height }) => ({ widgetType, x, y, w: width, h: height })) } };
  } catch (error) { return aiFailure(error, "배치를 추천하지 못했어요."); }
}

export async function applyAiLayout(roomId: number, widgets: RecommendedWidget[], mockId?: string): Promise<AiResult<DashboardSnapshot>> {
  try {
    const path = layoutPath(roomId);
    if (!isMock) {
      const parsed = placements.safeParse(widgets);
      if (!parsed.success) throw new Error("추천 배치를 확인할 수 없어요.");
      return saved(roomId, toDashboardSnapshot(roomId, await api(`${path}/apply`, { method: "POST", json: { widgets: parsed.data } })));
    }
    const { key } = await getAiContext(roomId);
    const proposal = aiMock.proposals.get(key);
    if (!proposal || proposal.id !== mockId) throw new Error("추천이 만료됐어요. 다시 추천받아 주세요.");
    const layout = getMockLayout(roomId);
    if (proposal.revision !== layout.revision) {
      aiMock.proposals.delete(key);
      throw new Error("대시보드 배치가 변경됐어요. 다시 추천받아 주세요.");
    }
    const current = roomWidgets.filter((widget) => widget.roomId === roomId);
    if (current.length !== proposal.widgets.length || current.some((widget) => !proposal.widgets.some((item) => item.id === widget.id && item.widgetType === widget.widgetType))) {
      throw new Error("위젯 구성이 변경됐어요. 다시 추천받아 주세요.");
    }
    const validated: RoomWidget[] = [];
    for (const widget of proposal.widgets) {
      if (!canPlaceWidget(widget, widget, validated)) throw new Error("적용할 수 없는 배치예요.");
      validated.push(widget);
    }
    const previous = current.map((widget) => ({ ...widget }));
    for (const widget of current) Object.assign(widget, proposal.widgets.find(({ id }) => id === widget.id));
    layout.revision += 1;
    aiMock.undos.set(key, { widgets: previous, revision: layout.revision });
    aiMock.proposals.delete(key);
    return saved(roomId, getMockDashboardSnapshot(roomId));
  } catch (error) { return aiFailure(error, "배치를 적용하지 못했어요."); }
}

export async function undoAiLayout(roomId: number): Promise<AiResult<DashboardSnapshot>> {
  try {
    const path = layoutPath(roomId);
    if (!isMock) return saved(roomId, toDashboardSnapshot(roomId, await api(`${path}/undo`, { method: "POST" })));
    const { key } = await getAiContext(roomId);
    const undo = aiMock.undos.get(key);
    const layout = getMockLayout(roomId);
    if (!undo || undo.revision !== layout.revision) return { ok: false, code: "DASHBOARD_UNDO_NOT_AVAILABLE", error: "다른 배치 변경이 있어 되돌릴 수 없어요." };
    const current = roomWidgets.filter((widget) => widget.roomId === roomId);
    if (current.length !== undo.widgets.length) throw new Error("위젯 구성이 변경됐어요.");
    for (const widget of current) Object.assign(widget, undo.widgets.find(({ id }) => id === widget.id));
    layout.revision += 1;
    aiMock.undos.delete(key);
    return saved(roomId, getMockDashboardSnapshot(roomId));
  } catch (error) { return aiFailure(error, "되돌리지 못했어요."); }
}
