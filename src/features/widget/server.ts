import "server-only";

import { getManagedRoom } from "@/features/room/management/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { roomWidgets } from "@/mocks/db";
import type { RoomWidget } from "@/types/db";

import { getMockDashboardSnapshot } from "./mock-layout";

/** 방 대시보드의 위젯 배치 조회. 대시보드 진입 시 가장 먼저 부른다. */
export async function listRoomWidgets(roomId: number): Promise<RoomWidget[]> {
  if (isMock) return roomWidgets.filter((w) => w.roomId === roomId);
  return api<RoomWidget[]>(`/api/v1/rooms/${roomId}/dashboard/widgets`, { cache: "no-store" });
}

export function canEditDashboard() {
  return isMock;
}

export async function openDashboardEvents(roomId: number, signal: AbortSignal) {
  if (!isMock) return new Response(null, { status: 501 });
  if (!(await getManagedRoom(roomId))) return new Response(null, { status: 403 });

  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let latest = "";
      let timer: ReturnType<typeof setTimeout>;
      let closed = false;
      const close = () => {
        stop();
        controller.close();
      };
      stop = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", close);
      };
      const publish = async () => {
        const room = await getManagedRoom(roomId).catch(() => null);
        if (closed) return;
        if (!room) return close();
        const snapshot = JSON.stringify(getMockDashboardSnapshot(roomId));
        controller.enqueue(encoder.encode(snapshot === latest ? ": ping\n\n" : `data: ${snapshot}\n\n`));
        latest = snapshot;
        timer = setTimeout(() => void publish(), 750);
      };
      signal.addEventListener("abort", close, { once: true });
      if (signal.aborted) close();
      else void publish();
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
