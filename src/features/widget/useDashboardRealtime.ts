"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { IDEA_BOARD_EVENTS } from "@/features/idea/realtime-events";
import { MEDIATION_EVENTS } from "@/features/mediation/model";
import type { RoomEvent } from "@/features/realtime/room-event";
import { useRoomRealtime } from "@/features/realtime/RoomRealtimeProvider";
import type { RoomWidget } from "@/types/db";

import { type ActiveEditor, updateWidgetEditors } from "./live-editing";
import type { DashboardSnapshot } from "./live-types";
import { parseDashboardSnapshot } from "./snapshot";

export function useDashboardRealtime(roomId: number, accountId: number, widgets: RoomWidget[], applySnapshot: (snapshot: DashboardSnapshot) => void) {
  const router = useRouter();
  const realtime = useRoomRealtime();
  const listen = realtime?.listen;
  const publish = realtime?.publish;
  const generation = realtime?.connectionGeneration ?? 0;
  const [editors, setEditors] = useState<ActiveEditor[]>([]);
  const hasIdeaBoard = widgets.some(({ widgetType }) => widgetType === "IDEA_BOARD");
  const hasMediation = widgets.some(({ widgetType }) => widgetType === "MEDIATION");

  useEffect(() => {
    if (!listen) return;
    const handleEvent = ({ type, payload }: RoomEvent) => {
      if (type === "LAYOUT_CHANGED") {
        const snapshot = parseDashboardSnapshot(roomId, payload);
        if (snapshot) applySnapshot(snapshot);
        else router.refresh();
      }
      if (type === "WIDGET_EDITING") {
        const now = Date.now();
        setEditors((current) => updateWidgetEditors(current, payload, accountId, now));
      }
      if ((hasIdeaBoard && IDEA_BOARD_EVENTS.includes(type)) || (hasMediation && MEDIATION_EVENTS.includes(type))) {
        router.refresh();
      }
    };
    return listen(handleEvent);
  }, [accountId, applySnapshot, hasIdeaBoard, hasMediation, listen, roomId, router]);

  useEffect(() => {
    // 구독이 다시 열린 뒤 조회해 연결이 비어 있던 동안의 변경도 반영한다.
    if (generation > 0) router.refresh();
  }, [generation, router]);

  useEffect(() => {
    const ids = new Set(widgets.map(({ id }) => id));
    setEditors((current) => {
      const active = current.filter(({ widgetId }) => ids.has(widgetId));
      return active.length === current.length ? current : active;
    });
  }, [widgets]);

  useEffect(() => {
    if (editors.length === 0) return;
    const expires = Math.min(...editors.map(({ expiresAt }) => expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      setEditors((current) => current.filter(({ expiresAt }) => expiresAt > now));
    }, Math.max(0, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [editors]);

  const publishEditing = useCallback((widgetId: number, editing: boolean) => {
    publish?.(`/app/rooms/${roomId}/widgets/${widgetId}/editing`, { editing });
  }, [publish, roomId]);

  const visibleEditors = editors.filter(({ widgetId }) => widgets.some(({ id }) => id === widgetId));
  return { liveEditors: visibleEditors, publishEditing, reconnecting: realtime?.connection === "reconnecting" };
}
