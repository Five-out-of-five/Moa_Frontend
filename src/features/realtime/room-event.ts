export type RoomEvent = {
  type: string;
  payload: unknown;
};

export function parseRoomEvent(body: string): RoomEvent | null {
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string" && "payload" in value) {
      return { type: value.type, payload: value.payload };
    }
  } catch {
    // 잘못된 메시지 하나로 방 구독을 끊지 않는다.
  }
  return null;
}
