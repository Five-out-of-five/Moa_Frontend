"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { RoomWidget } from "@/types/db";

import { saveWidgetPlacementAction, setWidgetEditingAction } from "./actions";
import type { WidgetPlacement } from "./grid";
import type { DashboardSnapshot } from "./live-types";

export function useDashboardLayout(roomId: number, initialWidgets: RoomWidget[], editable: boolean) {
  const [layout, setLayout] = useState({ revision: -1, widgets: initialWidgets });
  const [editors, setEditors] = useState<DashboardSnapshot["editors"]>([]);
  const [pending, setPending] = useState<{ id: number; placement: WidgetPlacement } | null>(null);
  const session = useRef<string | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!editable) return;
    session.current ??= crypto.randomUUID();
    const stream = new EventSource(`/api/rooms/${roomId}/dashboard/events`);
    stream.onmessage = ({ data }: MessageEvent<string>) => {
      const snapshot = JSON.parse(data) as DashboardSnapshot;
      setLayout((current) => current.revision > snapshot.revision ? current : snapshot);
      setEditors(snapshot.editors.filter(({ sessionId }) => sessionId !== session.current));
    };
    return () => {
      stream.close();
      clearInterval(heartbeat.current);
    };
  }, [editable, roomId]);

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
      if (!result.ok) toast.error(result.message);
      else {
        const snapshot = result.snapshot;
        setLayout((current) => current.revision > snapshot.revision ? current : snapshot);
      }
    } catch {
      toast.error("위젯 배치를 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  return {
    widgets: editable ? layout.widgets : initialWidgets,
    editors,
    pending,
    setEditing,
    save,
  };
}
