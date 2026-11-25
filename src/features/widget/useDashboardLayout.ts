"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { RoomWidget } from "@/types/db";

import { saveWidgetPlacementAction, setWidgetEditingAction } from "./actions";
import { WIDGET_MINIMUM, type WidgetPlacement } from "./grid";
import type { DashboardSnapshot } from "./live-types";

const snapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  widgets: z.array(z.object({
    id: z.number().int().positive(),
    roomId: z.number().int().positive(),
    widgetType: z.custom<RoomWidget["widgetType"]>(
      (value) => typeof value === "string" && Object.hasOwn(WIDGET_MINIMUM, value),
    ),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })),
  editors: z.array(z.object({ widgetId: z.number().int().positive(), sessionId: z.string() })),
});

function parseSnapshot(data: string) {
  try {
    const snapshot = snapshotSchema.safeParse(JSON.parse(data));
    if (snapshot.success) return snapshot.data;
  } catch {
    // 연결을 유지하고 다음 정상 이벤트를 기다린다.
  }
}

export function useDashboardLayout(roomId: number, initialSnapshot: DashboardSnapshot, shouldOpenMockStream: boolean) {
  const [layout, setLayout] = useState(initialSnapshot);
  const [pending, setPending] = useState<{ id: number; placement: WidgetPlacement } | null>(null);
  const session = useRef<string | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setLayout((current) => current.revision > snapshot.revision ? current : snapshot);
  }, []);

  useEffect(() => {
    applySnapshot(initialSnapshot);
  }, [applySnapshot, initialSnapshot]);

  useEffect(() => {
    if (!shouldOpenMockStream) return;
    session.current ??= crypto.randomUUID();
    const stream = new EventSource(`/api/rooms/${roomId}/dashboard/events`);
    stream.onmessage = ({ data }: MessageEvent<string>) => {
      const snapshot = parseSnapshot(data);
      if (!snapshot) return;
      applySnapshot(snapshot);
    };
    return () => {
      stream.close();
      clearInterval(heartbeat.current);
    };
  }, [applySnapshot, shouldOpenMockStream, roomId]);

  function setEditing(widgetId: number | null) {
    clearInterval(heartbeat.current);
    const sessionId = session.current;
    if (!sessionId) return;
    const publish = () => {
      void setWidgetEditingAction(roomId, widgetId, sessionId).catch(() => undefined);
    };
    publish();
    if (widgetId !== null) heartbeat.current = setInterval(publish, 3_000);
  }

  async function save(id: number, placement: WidgetPlacement) {
    setPending({ id, placement });
    try {
      const result = await saveWidgetPlacementAction(roomId, id, placement);
      if (result.snapshot) applySnapshot(result.snapshot);
      if (!result.ok) toast.error(result.message);
    } catch {
      toast.error("위젯 배치를 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  return {
    widgets: layout.widgets,
    editors: session.current ? layout.editors.filter(({ sessionId }) => sessionId !== session.current) : [],
    pending,
    setEditing,
    save,
    applySnapshot,
  };
}
