"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useRoomRealtime } from "./RoomRealtimeProvider";

export function RoomEventRefresh({ eventType, refreshOnConnect = true }: {
  eventType: string;
  refreshOnConnect?: boolean;
}) {
  const router = useRouter();
  const realtime = useRoomRealtime();
  const listen = realtime?.listen;
  const generation = realtime?.connectionGeneration ?? 0;

  useEffect(() => listen?.(({ type }) => {
    if (type === eventType) router.refresh();
  }), [eventType, listen, router]);

  useEffect(() => {
    if (refreshOnConnect && generation > 0) router.refresh();
  }, [generation, refreshOnConnect, router]);

  return null;
}
