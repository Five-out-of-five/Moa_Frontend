import "server-only";

import { getManagedRoom } from "@/features/room/management/server";
import { isMock } from "@/mocks/config";

import { aiMock } from "./mock-state";

export async function getAiContext(roomId: number) {
  if (!isMock) throw new Error("AI 기능의 실서버 연결을 준비 중이에요.");
  const context = await getManagedRoom(roomId);
  if (!context) throw new Error("이 방의 AI 기능에 접근할 수 없어요.");
  return { ...context, key: `${roomId}:${context.membership.id}` };
}

export async function getAiHistory(roomId: number) {
  const context = await getAiContext(roomId);
  return (aiMock.messages.get(context.key) ?? []).map((item) => ({ ...item }));
}
