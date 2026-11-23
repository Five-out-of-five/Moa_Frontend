"use client";

import { useEffect } from "react";

import { recordLastRoomAction } from "../actions";

export function RecordLastRoom({ roomId }: { roomId: number }) {
  useEffect(() => {
    void recordLastRoomAction(roomId).catch(() => {
      // 방문 기록 요청이 실패해도 방을 계속 사용할 수 있다.
    });
  }, [roomId]);

  return null;
}
