"use client";

import { useEffect, useState } from "react";

import { setIdeaEditLock } from "./discussion-actions";

export function useIdeaEditLock(open: boolean, lockRoomId?: number, lockCardId?: number) {
  const [lock, setLock] = useState<{ ready?: boolean; error?: string }>({});


  useEffect(() => {
    if (!open || lockRoomId === undefined || lockCardId === undefined) return;
    let active = true;
    let acquired = false;
    let timer: ReturnType<typeof setTimeout>;
    async function renew(roomId: number, cardId: number) {
      try {
        const result = await setIdeaEditLock(roomId, cardId, true);
        acquired = result.saved === true;
        if (!active) {
          if (acquired) void setIdeaEditLock(roomId, cardId, false).catch(() => {});
          return;
        }
        setLock({ ready: acquired, error: result.error });
        if (acquired) timer = setTimeout(() => void renew(roomId, cardId), 20_000);
      } catch {
        if (active) setLock({ error: "편집 잠금을 확인하지 못했어요." });
      }
    }
    void renew(lockRoomId, lockCardId);
    return () => {
      active = false;
      clearTimeout(timer);
      if (acquired) void setIdeaEditLock(lockRoomId, lockCardId, false).catch(() => {});
    };
  }, [open, lockRoomId, lockCardId]);

  return { lock, resetLock: () => setLock({}) };
}
