"use client";

import { useEffect, useState } from "react";

import { useRoomRealtime } from "@/features/realtime/RoomRealtimeProvider";

import { updateIdeaCardLocks } from "./realtime-events";

export function useIdeaCardLocks() {
  const listen = useRoomRealtime()?.listen;
  const [locks, setLocks] = useState<ReturnType<typeof updateIdeaCardLocks>>(() => new Map());

  useEffect(() => listen?.((event) => {
    const now = Date.now();
    setLocks((current) => updateIdeaCardLocks(current, event, now));
  }), [listen]);

  useEffect(() => {
    if (!locks.size) return;
    const earliest = Math.min(...Array.from(locks.values(), ({ expiresAt }) => expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      setLocks((current) => new Map([...current].filter(([, { expiresAt }]) => expiresAt > now)));
    }, Math.max(0, earliest - Date.now()));
    return () => clearTimeout(timer);
  }, [locks]);

  return locks;
}
