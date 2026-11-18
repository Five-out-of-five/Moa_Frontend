"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function IdeaBoardLive({ roomId, revision }: { roomId: number; revision: number }) {
  const router = useRouter();
  useEffect(() => {
    let current = revision;
    const stream = new EventSource(`/api/rooms/${roomId}/idea-board/events`);
    stream.onmessage = ({ data }) => {
      const next = Number(data);
      if (!Number.isSafeInteger(next) || next === current) return;
      current = next;
      router.refresh();
    };
    return () => stream.close();
  }, [revision, roomId, router]);
  return null;
}
