"use client";

import { useEffect, useRef, useState } from "react";

import { setIdeaEditLock } from "./discussion-actions";

export function useIdeaEditLock(open: boolean, lockRoomId?: number, lockCardId?: number) {
  const [lock, setLock] = useState<{ ready?: boolean; acquired?: boolean; error?: string }>({});
  const retry = useRef<(() => void) | null>(null);
  const release = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!open || lockRoomId === undefined || lockCardId === undefined) return;
    let active = true;
    let acquired = false;
    let request: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function renew(roomId: number, cardId: number) {
      try {
        const result = await setIdeaEditLock(roomId, cardId, true);
        const ready = result.saved === true;
        acquired ||= ready;
        if (!active) return;
        setLock({ ready, acquired, error: ready ? undefined : result.error ?? "편집 잠금을 확인하지 못했어요." });
        if (ready) timer = setTimeout(start, 20_000);
      } catch {
        if (active) setLock({ acquired, error: "편집 잠금을 확인하지 못했어요." });
      } finally {
        request = null;
      }
    }
    const previousRelease = release.current;
    const start = () => {
      if (!active || request) return;
      request = Promise.resolve(previousRelease).then(() => {
        if (active) return renew(lockRoomId, lockCardId);
      });
    };
    retry.current = () => {
      if (request) return;
      setLock({ acquired });
      start();
    };
    start();
    return () => {
      active = false;
      retry.current = null;
      clearTimeout(timer);
      release.current = Promise.resolve(request).then(() => {
        if (acquired) return setIdeaEditLock(lockRoomId, lockCardId, false);
      }).catch(() => {});
    };
  }, [open, lockRoomId, lockCardId]);

  return { lock, resetLock: () => setLock({}), retryLock: () => retry.current?.() };
}
