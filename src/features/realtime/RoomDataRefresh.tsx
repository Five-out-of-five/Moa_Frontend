"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useRoomRealtime } from "./RoomRealtimeProvider";

export function RoomDataRefresh({ eventTypes }: { eventTypes: readonly string[] }) {
  const router = useRouter();
  const realtime = useRoomRealtime();
  const listen = realtime?.listen;
  const generation = realtime?.connectionGeneration ?? 0;

  useEffect(() => listen?.(({ type }) => {
    if (eventTypes.includes(type)) router.refresh();
  }), [eventTypes, listen, router]);

  useEffect(() => {
    if (generation > 0) router.refresh();
  }, [generation, router]);

  return null;
}
