import "server-only";

import { getManagedRoom } from "@/features/room/management/server";
import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";

import { getMockDashboardSnapshot } from "./mock-layout";
import { toDashboardSnapshot } from "./snapshot";

/** 방 대시보드의 위젯 배치 조회. 대시보드 진입 시 가장 먼저 부른다. */
export async function getDashboardSnapshot(roomId: number) {
  if (isMock) return getMockDashboardSnapshot(roomId);
  const response = await api<unknown>(`/api/v1/rooms/${roomId}/dashboard`, { cache: "no-store" });
  return toDashboardSnapshot(roomId, response);
}

export function usesMockDashboardEvents() {
  return isMock;
}

export async function openDashboardEvents(roomId: number, signal: AbortSignal) {
  return openMockRoomEvents(roomId, signal, () => getMockDashboardSnapshot(roomId));
}

export async function openMockRoomEvents(roomId: number, signal: AbortSignal, read: () => unknown) {
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
        const snapshot = JSON.stringify(read());
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
