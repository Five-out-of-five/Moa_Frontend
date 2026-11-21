"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { canPlaceWidget, findOpenPlacement, WIDGET_MINIMUM } from "@/features/widget/grid";
import { getMockLayout } from "@/features/widget/mock-layout";
import { roomWidgets } from "@/mocks/db";
import type { RoomWidget } from "@/types/db";

import { aiMock, takeAiCall } from "./mock-state";
import { getAiContext } from "./server";
import type { AiResult, LayoutProposal } from "./types";

export async function recommendLayout(roomId: number, purpose: string): Promise<AiResult<LayoutProposal>> {
  try {
    const context = await getAiContext(roomId);
    if (typeof purpose !== "string" || !purpose.trim() || purpose.length > 200) throw new Error("목적을 1~200자로 입력해 주세요.");
    takeAiCall(roomId, "assistant-layout");
    const current = roomWidgets.filter((widget) => widget.roomId === roomId);
    if (!current.length) throw new Error("대시보드에 위젯을 먼저 추가해 주세요.");
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
    const proposal = { id: randomUUID(), widgets, revision: getMockLayout(roomId).revision, reason: /회고|아이디어/.test(purpose)
      ? "아이디어와 팀 상태를 먼저 확인할 수 있도록 배치했어요."
      : "업무와 진행 상황을 먼저 확인할 수 있도록 배치했어요." };
    aiMock.proposals.set(context.key, proposal);
    return { ok: true, data: proposal };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "배치를 추천하지 못했어요." }; }
}

export async function applyAiLayout(roomId: number, proposalId: string): Promise<AiResult<string>> {
  try {
    const { key } = await getAiContext(roomId);
    const proposal = aiMock.proposals.get(key);
    if (!proposal || proposal.id !== proposalId) throw new Error("추천이 만료됐어요. 다시 추천받아 주세요.");
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
    revalidatePath(`/rooms/${roomId}`);
    return { ok: true, data: "적용했어요." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "배치를 적용하지 못했어요." }; }
}

export async function undoAiLayout(roomId: number): Promise<AiResult<string>> {
  try {
    const { key } = await getAiContext(roomId);
    const undo = aiMock.undos.get(key);
    const layout = getMockLayout(roomId);
    if (!undo || undo.revision !== layout.revision) throw new Error("다른 배치 변경이 있어 되돌릴 수 없어요.");
    const current = roomWidgets.filter((widget) => widget.roomId === roomId);
    if (current.length !== undo.widgets.length) throw new Error("위젯 구성이 변경됐어요.");
    for (const widget of current) Object.assign(widget, undo.widgets.find(({ id }) => id === widget.id));
    layout.revision += 1;
    aiMock.undos.delete(key);
    revalidatePath(`/rooms/${roomId}`);
    return { ok: true, data: "이전 배치로 되돌렸어요." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "되돌리지 못했어요." }; }
}
